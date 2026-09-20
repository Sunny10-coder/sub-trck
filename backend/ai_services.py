"""Direct AI provider adapters for SubMind.

Provider keys may come from the server environment or request-scoped headers set by
server.py. Keys are never written to the database or included in logs.
"""
import base64
import json
import logging
import os
import re
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import quote

import httpx

logger = logging.getLogger("submind.ai")

_GEMINI_REQUEST_KEY: ContextVar[Optional[str]] = ContextVar("gemini_request_key", default=None)
_OPENAI_REQUEST_KEY: ContextVar[Optional[str]] = ContextVar("openai_request_key", default=None)

FAST_MODEL = os.environ.get("GEMINI_FAST_MODEL", "gemini-2.5-flash")
PRO_MODEL = os.environ.get("GEMINI_PRO_MODEL", "gemini-2.5-pro")
OPENAI_STT_MODEL = os.environ.get("OPENAI_STT_MODEL", "whisper-1")
GEMINI_API_URL = os.environ.get(
    "GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta"
).rstrip("/")
OPENAI_API_URL = os.environ.get("OPENAI_API_URL", "https://api.openai.com/v1").rstrip("/")

EXTRACTION_SCHEMA_HINT = """Return ONLY a strict JSON object (no markdown, no prose) with keys:
{
  "content_type": one of ["subscription","trial","plan","link","reminder","payment","note","unknown"],
  "provider": string,
  "product": string,
  "plan": string,
  "price": number or null,
  "currency": string (ISO like "AED","USD"; default "AED" if unknown),
  "billing_cycle": one of ["monthly","yearly","weekly","custom",""],
  "renewal_date": "YYYY-MM-DD" or null,
  "trial_end": "YYYY-MM-DD" or null,
  "offer_expiry": "YYYY-MM-DD" or null,
  "category": string (e.g. "AI","Streaming","Music","Productivity","Cloud","Gaming","News","Fitness","Other"),
  "tags": array of short strings,
  "summary": string (one concise sentence),
  "source_type": string,
  "confidence": number between 0 and 1
}"""


class ProviderError(RuntimeError):
    """A configured provider rejected or returned an invalid response."""


class ProviderNotConfigured(ProviderError):
    """No usable API key exists for the requested provider."""


@contextmanager
def provider_keys(gemini_api_key: Optional[str], openai_api_key: Optional[str]) -> Iterator[None]:
    """Set request-only BYOK values for the duration of one HTTP request."""
    gemini_token = _GEMINI_REQUEST_KEY.set((gemini_api_key or "").strip() or None)
    openai_token = _OPENAI_REQUEST_KEY.set((openai_api_key or "").strip() or None)
    try:
        yield
    finally:
        _GEMINI_REQUEST_KEY.reset(gemini_token)
        _OPENAI_REQUEST_KEY.reset(openai_token)


def _gemini_key() -> str:
    return _GEMINI_REQUEST_KEY.get() or os.environ.get("GEMINI_API_KEY", "").strip()


def _openai_key() -> str:
    return _OPENAI_REQUEST_KEY.get() or os.environ.get("OPENAI_API_KEY", "").strip()


def mask_sensitive(text: str) -> str:
    """Mask common card/account patterns before sending text to a provider."""
    if not text:
        return text
    text = re.sub(r"\b(?:\d[ -]?){13,19}\b", "[REDACTED_CARD]", text)
    return re.sub(r"\bCVV[:\s]*\d{3,4}\b", "[REDACTED_CVV]", text, flags=re.I)


def _extract_json(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    cleaned = re.sub(r"^```(?:json)?", "", raw.strip()).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        value = json.loads(cleaned[start : end + 1])
        return value if isinstance(value, dict) else None
    except (TypeError, ValueError):
        return None


def _normalize_extraction(data: Dict[str, Any], source_type: str) -> Dict[str, Any]:
    def string(value: Any) -> str:
        return str(value).strip() if value is not None else ""

    output = {
        "content_type": string(data.get("content_type") or "unknown").lower(),
        "provider": string(data.get("provider")),
        "product": string(data.get("product")),
        "plan": string(data.get("plan")),
        "price": data.get("price") if isinstance(data.get("price"), (int, float)) else None,
        "currency": (string(data.get("currency")) or "AED").upper(),
        "billing_cycle": string(data.get("billing_cycle")).lower(),
        "renewal_date": data.get("renewal_date") or None,
        "trial_end": data.get("trial_end") or None,
        "offer_expiry": data.get("offer_expiry") or None,
        "category": string(data.get("category")) or "Other",
        "tags": [string(tag) for tag in data.get("tags", []) if string(tag)][:8],
        "summary": string(data.get("summary")),
        "source_type": source_type,
        "confidence": float(data.get("confidence"))
        if isinstance(data.get("confidence"), (int, float))
        else 0.5,
    }
    output["confidence"] = max(0.0, min(1.0, output["confidence"]))
    return output


def _image_part(image_base64: str) -> Dict[str, Any]:
    data = image_base64.strip()
    mime_type = "image/jpeg"
    match = re.match(r"^data:([^;,]+);base64,(.*)$", data, flags=re.S)
    if match:
        mime_type, data = match.group(1), match.group(2)
    else:
        try:
            sample = base64.b64decode(data[:48] + "===", validate=False)
            if sample.startswith(b"\x89PNG"):
                mime_type = "image/png"
            elif sample.startswith((b"GIF87a", b"GIF89a")):
                mime_type = "image/gif"
            elif sample.startswith(b"RIFF") and b"WEBP" in sample:
                mime_type = "image/webp"
        except (ValueError, TypeError):
            pass
    return {"inline_data": {"mime_type": mime_type, "data": data}}


def _response_text(payload: Dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        reason = (payload.get("promptFeedback") or {}).get("blockReason", "no candidates")
        raise ProviderError(f"Gemini returned no content ({reason})")
    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    text = "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict)).strip()
    if not text:
        raise ProviderError("Gemini returned an empty response")
    return text


async def _gemini_generate(
    system: str,
    prompt: str,
    model: str,
    image_base64: Optional[str] = None,
    json_response: bool = False,
) -> str:
    api_key = _gemini_key()
    if not api_key:
        raise ProviderNotConfigured("Gemini API key is not configured")

    parts: List[Dict[str, Any]] = [{"text": prompt}]
    if image_base64:
        parts.append(_image_part(image_base64))
    generation_config: Dict[str, Any] = {"temperature": 0.1, "maxOutputTokens": 2048}
    if json_response:
        generation_config["responseMimeType"] = "application/json"
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": generation_config,
    }
    model_name = model.removeprefix("models/")
    url = f"{GEMINI_API_URL}/models/{quote(model_name, safe='-_.')}:generateContent"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
            response = await client.post(
                url,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise ProviderError("Could not reach Gemini") from exc
    if response.status_code >= 400:
        raise ProviderError(f"Gemini request failed with status {response.status_code}")
    try:
        return _response_text(response.json())
    except (TypeError, ValueError) as exc:
        raise ProviderError("Gemini returned invalid JSON") from exc


async def ai_extract(
    text: str = "", image_base64: Optional[str] = None, source_type: str = "manual"
) -> Dict[str, Any]:
    """Extract structured data with a user key or server-side Gemini key."""
    system = (
        "You are SubMind's extraction engine. Read subscription screenshots, receipts, "
        "offers, links, or notes and extract structured data. Be accurate; if unsure, "
        "lower confidence. " + EXTRACTION_SCHEMA_HINT
    )
    safe_text = mask_sensitive(text)
    prompt = f"Source: {source_type}\nContent:\n{safe_text or '(image only)'}"
    models = [PRO_MODEL, FAST_MODEL] if image_base64 else [FAST_MODEL, PRO_MODEL]
    for model in dict.fromkeys(models):
        try:
            raw = await _gemini_generate(
                system, prompt, model, image_base64=image_base64, json_response=True
            )
            parsed = _extract_json(raw)
            if parsed:
                return _normalize_extraction(parsed, source_type)
        except ProviderError as exc:
            logger.warning("Gemini extraction failed for model %s: %s", model, exc)
    return _normalize_extraction(
        {"content_type": "unknown", "summary": safe_text[:140], "confidence": 0.2},
        source_type,
    )


async def ai_chat_answer(question: str, context: str) -> str:
    system = (
        "You are SubMind AI, a friendly assistant that answers ONLY from the user's "
        "stored SubMind data below. Never invent subscriptions, prices, or dates. If the "
        "data does not contain the answer, say so plainly. Keep answers concise and "
        f"format money clearly.\n\nUSER DATA:\n{context}"
    )
    for model in dict.fromkeys([PRO_MODEL, FAST_MODEL]):
        try:
            return await _gemini_generate(system, question, model)
        except ProviderError as exc:
            logger.warning("Gemini chat failed for model %s: %s", model, exc)
    return "I couldn't reach the AI service. Check your Gemini key in Profile and try again."


async def ai_compare(items: List[Dict[str, Any]]) -> str:
    system = (
        "Compare subscription plans objectively. Give a short markdown-free comparison "
        "highlighting price, value, and differences. End with one neutral informational "
        "observation. Do not give financial advice."
    )
    prompt = "Compare these plans:\n" + json.dumps(items, default=str)
    for model in dict.fromkeys([PRO_MODEL, FAST_MODEL]):
        try:
            return await _gemini_generate(system, prompt, model)
        except ProviderError as exc:
            logger.warning("Gemini comparison failed for model %s: %s", model, exc)
    return "Comparison unavailable. Check your Gemini key in Profile and try again."


async def transcribe_audio(data: bytes, filename: str, content_type: Optional[str]) -> str:
    """Send an audio file directly to OpenAI's transcription API."""
    api_key = _openai_key()
    if not api_key:
        raise ProviderNotConfigured("OpenAI API key is not configured")
    files = {"file": (filename or "voice.m4a", data, content_type or "audio/mp4")}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            response = await client.post(
                f"{OPENAI_API_URL}/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                data={"model": OPENAI_STT_MODEL},
                files=files,
            )
    except httpx.HTTPError as exc:
        raise ProviderError("Could not reach OpenAI transcription") from exc
    if response.status_code >= 400:
        raise ProviderError(f"OpenAI transcription failed with status {response.status_code}")
    try:
        text = response.json().get("text", "")
    except (TypeError, ValueError) as exc:
        raise ProviderError("OpenAI transcription returned invalid JSON") from exc
    return str(text or "").strip()
