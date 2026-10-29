import { AGENT_FUNCTION_DECLARATIONS, AGENT_SYSTEM_RULES, NVIDIA_AGENT_INSTRUCTIONS, isAddIntent, isCancelIntent, parseAgentJson, type AgentChatResult, type AgentToolCall } from "./agent-tools";
import type { AiPort, LinkMetadata } from "./ai-port";
import { loadClientConfig } from "./client-config";
import { fallbackExtraction, normalizeExtraction, type Extraction } from "./local-models";

const FAST_MODEL = "gemini-flash-latest";
const PRO_MODEL = "gemini-pro-latest";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_TEXT_MODEL = "meta/llama-3.1-70b-instruct";
const NVIDIA_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const OPENAI_API_URL = "https://api.openai.com/v1";
const OPENAI_STT_MODEL = "whisper-1";

const EXTRACTION_SCHEMA_HINT = `Return ONLY a strict JSON object (no markdown, no prose) with keys:
{
  "content_type": one of ["subscription","account","trial","plan","link","check_later","reminder","payment","note","unknown"],
  "provider": string,
  "product": string,
  "service_name": string (for accounts or registered websites),
  "service_url": string or null,
  "email_used": string or null (the user's email address used to register or login),
  "username": string or null (user handle/login name),
  "auth_method": one of ["email","google","apple","github","phone","other"] or null,
  "plan": string,
  "price": number or null,
  "currency": string (ISO like "AED","USD"; default "AED" if unknown),
  "billing_cycle": one of ["monthly","yearly","weekly","custom",""],
  "renewal_date": "YYYY-MM-DD" or null (the NEXT renewal/expiry date - this is what the user almost always knows),
  "start_date": "YYYY-MM-DD" or null (ONLY if a start/subscribed-since date is explicitly visible; never guess this),
  "trial_end": "YYYY-MM-DD" or null,
  "offer_expiry": "YYYY-MM-DD" or null,
  "category": string,
  "tags": array of 3-8 short lowercase topic tags a person would search for later (specific technologies, use cases, tool types, e.g. "ai-agents","react-native","video-generation","prompt-engineering"),
  "summary": string,
  "source_type": string,
  "confidence": number between 0 and 1,
  "detected_url": any http(s) URL visible in the text or image (a link, handle, or "visit x.com"), or null
}`;

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

function maskSensitive(text: string): string {
  if (!text) return text;
  return text.replace(/\b(?:\d[ -]?){13,19}\b/g, "[REDACTED_CARD]").replace(/\bCVV[:\s]*\d{3,4}\b/gi, "[REDACTED_CVV]");
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function imagePart(imageBase64: string): Record<string, unknown> {
  let data = imageBase64.trim();
  let mimeType = "image/jpeg";
  const match = data.match(/^data:([^;,]+);base64,(.*)$/s);
  if (match) {
    mimeType = match[1];
    data = match[2];
  }
  return { inline_data: { mime_type: mimeType, data } };
}

function responseText(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  if (!candidates.length) throw new ProviderError("Gemini returned no content");
  const content = (candidates[0] as { content?: { parts?: { text?: string }[] } }).content;
  const text = (content?.parts || []).map((part) => part.text || "").join("").trim();
  if (!text) throw new ProviderError("Gemini returned an empty response");
  return text;
}

async function geminiGenerate(
  apiKey: string,
  system: string,
  prompt: string,
  model: string,
  imageBase64?: string,
  jsonResponse = false,
): Promise<string> {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (imageBase64) parts.push(imagePart(imageBase64));
  const generationConfig: Record<string, unknown> = { temperature: 0.1, maxOutputTokens: 2048 };
  if (jsonResponse) generationConfig.responseMimeType = "application/json";
  const url = `${GEMINI_API_URL}/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig,
    }),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const err = (await response.json()) as { error?: { message?: string } };
      detail = err.error?.message || "";
    } catch {
      detail = "";
    }
    throw new ProviderError(detail || `Gemini request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>;
  return responseText(payload);
}

function parseGeminiAgent(payload: Record<string, unknown>): AgentChatResult {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const parts = ((candidates[0] as { content?: { parts?: Record<string, any>[] } })?.content?.parts) || [];
  const texts: string[] = [];
  const toolCalls: AgentToolCall[] = [];
  for (const part of parts) {
    if (part?.text) texts.push(String(part.text));
    const call = part?.functionCall;
    if (call?.name) {
      toolCalls.push({
        name: String(call.name),
        args: call.args && typeof call.args === "object" ? call.args : {},
      });
    }
  }
  const text = texts.join("").trim();
  if (!toolCalls.length && text.includes("{") && text.includes("actions")) {
    const parsed = parseAgentJson(text);
    if (parsed.toolCalls.length) return parsed;
  }
  return { text, toolCalls };
}

async function geminiAgentChat(apiKey: string, question: string, context: string): Promise<AgentChatResult> {
  const system = `${AGENT_SYSTEM_RULES}\n\nUSER DATA:\n${context}`;
  let lastError: Error | null = null;
  for (const model of [FAST_MODEL, PRO_MODEL]) {
    try {
      const url = `${GEMINI_API_URL}/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: question }] }],
          tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }],
          toolConfig: {
            functionCallingConfig: isAddIntent(question)
              ? { mode: "ANY", allowedFunctionNames: ["add_subscription", "add_subscriptions", "add_account", "add_prompt"] }
              : isCancelIntent(question)
              ? { mode: "ANY", allowedFunctionNames: ["cancel_subscription", "update_subscription"] }
              : { mode: "AUTO" },
          },
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      });
      if (!response.ok) {
        let detail = "";
        try {
          const err = (await response.json()) as { error?: { message?: string } };
          detail = err.error?.message || "";
        } catch {
          detail = "";
        }
        throw new ProviderError(detail || `Gemini request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as Record<string, unknown>;
      return parseGeminiAgent(payload);
    } catch (error) {
      lastError = error instanceof Error ? error : new ProviderError("Gemini chat failed");
    }
  }
  throw lastError || new ProviderError("Gemini chat failed");
}

async function nvidiaGenerate(
  apiKey: string,
  system: string,
  prompt: string,
  imageBase64?: string,
): Promise<string> {
  const stripped = imageBase64
    ? imageBase64.replace(/^data:[^;]+;base64,/, "")
    : "";
  const userContent = stripped
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${stripped}` } },
      ]
    : prompt;
  const models = stripped ? [NVIDIA_VISION_MODEL, NVIDIA_TEXT_MODEL] : [NVIDIA_TEXT_MODEL];
  let lastError: Error | null = null;
  for (const model of models) {
    try {
      const response = await fetch(`${NVIDIA_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 2048,
          messages: [
            { role: "system", content: system },
            { role: "user", content: model === NVIDIA_TEXT_MODEL ? `${system}\n\n${prompt}` : userContent },
          ],
        }),
      });
      if (!response.ok) {
        let detail = "";
        try {
          const err = (await response.json()) as { message?: string; detail?: string };
          detail = err.message || err.detail || "";
        } catch {
          detail = "";
        }
        throw new ProviderError(detail || `NVIDIA request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const text = payload.choices?.[0]?.message?.content?.trim() || "";
      if (!text) throw new ProviderError("NVIDIA returned an empty response");
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new ProviderError("NVIDIA request failed");
    }
  }
  throw lastError || new ProviderError("NVIDIA request failed");
}

export async function extractWithGemini(input: {
  apiKey: string;
  text?: string;
  imageBase64?: string;
  sourceType: string;
}): Promise<Extraction> {
  const system =
    "You are SubMind's extraction engine. Read screenshots, receipts, offers, links, or notes. " +
    "Use content_type subscription ONLY when there is a billed recurring plan, price, or renewal. " +
    "If the screenshot is a website, article, product page, tweet, or something to look at later, use check_later — never subscription. " +
    "Be accurate; if unsure, lower confidence. " +
    EXTRACTION_SCHEMA_HINT;
  const safeText = maskSensitive(input.text || "");
  const prompt = `Source: ${input.sourceType}\nContent:\n${safeText || "(image only)"}`;
  const models = input.imageBase64 ? [PRO_MODEL, FAST_MODEL] : [FAST_MODEL, PRO_MODEL];
  let lastError: Error | null = null;
  for (const model of [...new Set(models)]) {
    try {
      const raw = await geminiGenerate(input.apiKey, system, prompt, model, input.imageBase64, true);
      const parsed = extractJson(raw);
      if (parsed) return normalizeExtraction(parsed, input.sourceType);
    } catch (error) {
      lastError = error instanceof Error ? error : new ProviderError("Gemini extraction failed");
    }
  }
  if (lastError) throw lastError;
  return fallbackExtraction(safeText, input.sourceType);
}

export async function chatWithGemini(apiKey: string, question: string, context: string): Promise<string> {
  const system =
    "You are SubMind AI, a friendly assistant that answers ONLY from the user's stored SubMind data below. Never invent subscriptions, prices, or dates. If the data does not contain the answer, say so plainly. Keep answers concise and format money clearly.\n\nUSER DATA:\n" +
    context;
  let lastError: Error | null = null;
  for (const model of [PRO_MODEL, FAST_MODEL]) {
    try {
      return await geminiGenerate(apiKey, system, question, model);
    } catch (error) {
      lastError = error instanceof Error ? error : new ProviderError("Gemini chat failed");
    }
  }
  throw lastError || new ProviderError("I couldn't reach the AI service. Check your Gemini key in Profile and try again.");
}

export async function compareWithGemini(apiKey: string, items: Record<string, unknown>[]): Promise<string> {
  const system =
    "Compare subscription plans objectively. Give a short markdown-free comparison highlighting price, value, and differences. End with one neutral informational observation. Do not give financial advice.";
  const prompt = `Compare these plans:\n${JSON.stringify(items)}`;
  let lastError: Error | null = null;
  for (const model of [PRO_MODEL, FAST_MODEL]) {
    try {
      return await geminiGenerate(apiKey, system, prompt, model);
    } catch (error) {
      lastError = error instanceof Error ? error : new ProviderError("Gemini comparison failed");
    }
  }
  throw lastError || new ProviderError("Comparison unavailable. Check your Gemini key in Profile and try again.");
}

export async function transcribeWithOpenAi(apiKey: string, uri: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri, name: "voice.m4a", type: "audio/mp4" } as never);
  form.append("model", OPENAI_STT_MODEL);
  const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new ProviderError(`OpenAI transcription failed with status ${response.status}`);
  const payload = (await response.json()) as { text?: string };
  return String(payload.text || "").trim();
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { title: "", thumbnail: null, description: "", text: "" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) links can be saved.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 SubMind" },
      signal: controller.signal,
    });
    const html = (await response.text()).slice(0, 200000);
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000);
    return { title, thumbnail: og?.[1] || null, description: desc?.[1] || "", text };
  } catch {
    return { title: "", thumbnail: null, description: "", text: "" };
  } finally {
    clearTimeout(timeout);
  }
}

export function createDeviceAi(): AiPort {
  const config = () => loadClientConfig({ refresh: true });
  return {
    async extract(input) {
      const loaded = await config();
      const system =
        "You are SubMind's extraction engine. Read screenshots, receipts, offers, links, or notes. " +
        "Use content_type subscription ONLY when there is a billed recurring plan, price, or renewal. " +
        "If the screenshot is a website, article, product page, tweet, or something to look at later, use check_later — never subscription. " +
        "Be accurate; if unsure, lower confidence. " +
        EXTRACTION_SCHEMA_HINT;
      const safeText = maskSensitive(input.text || "");
      const prompt = `Source: ${input.sourceType}\nContent:\n${safeText || "(image only)"}`;
      if (loaded.geminiApiKey) {
        try {
          return await extractWithGemini({
            apiKey: loaded.geminiApiKey,
            text: input.text,
            imageBase64: input.imageBase64,
            sourceType: input.sourceType,
          });
        } catch {
          // Fall through to NVIDIA.
        }
      }
      if (loaded.nvidiaApiKey) {
        try {
          const raw = await nvidiaGenerate(loaded.nvidiaApiKey, system, prompt, input.imageBase64);
          const parsed = extractJson(raw);
          if (parsed) return normalizeExtraction(parsed, input.sourceType);
        } catch {
          // Fall through to local fallback so the screenshot is still saved.
        }
      }
      return fallbackExtraction(input.text || "", input.sourceType);
    },
    async chat(question, context) {
      const loaded = await config();
      if (loaded.geminiApiKey) {
        try {
          return await geminiAgentChat(loaded.geminiApiKey, question, context);
        } catch {
          // Fall through to NVIDIA.
        }
      }
      if (loaded.nvidiaApiKey) {
        const raw = await nvidiaGenerate(
          loaded.nvidiaApiKey,
          `${NVIDIA_AGENT_INSTRUCTIONS}\n\nUSER DATA:\n${context}`,
          question,
        );
        return parseAgentJson(raw);
      }
      throw new ProviderError("Add a Gemini or NVIDIA API key in Profile to use AI chat.");
    },
    async compare(items) {
      const loaded = await config();
      const system =
        "Compare subscription plans objectively. Give a short markdown-free comparison highlighting price, value, and differences. End with one neutral informational observation. Do not give financial advice.";
      const prompt = `Compare these plans:\n${JSON.stringify(items)}`;
      if (loaded.geminiApiKey) {
        try {
          return await compareWithGemini(loaded.geminiApiKey, items);
        } catch {
          // Fall through to NVIDIA.
        }
      }
      if (loaded.nvidiaApiKey) {
        return nvidiaGenerate(loaded.nvidiaApiKey, system, prompt);
      }
      throw new ProviderError("Add a Gemini or NVIDIA API key in Profile to compare plans.");
    },
    async transcribe(uri) {
      const loaded = await config();
      if (!loaded.openAiApiKey) {
        throw new ProviderError("Add an OpenAI API key in Profile to transcribe voice.");
      }
      return transcribeWithOpenAi(loaded.openAiApiKey, uri);
    },
    async extractMany(text) {
      const loaded = await config();
      const system =
        'Extract EVERY distinct subscription, trial, or paid service mentioned. Include comma lists, "and" lists, and extra names after "also"/"plus". Return ONLY JSON {"items":[{"provider":"Netflix","price":50,"currency":"AED","billing_cycle":"monthly","plan":"","category":"Other"}]}. If the text is only a question, return {"items":[]}. Never skip a mentioned service.';
      const parseItems = (raw: string) => {
        const parsed = extractJson(raw) as { items?: Record<string, any>[] } | null;
        return Array.isArray(parsed?.items) ? parsed.items.filter((item) => item && item.provider) : [];
      };
      if (loaded.geminiApiKey) {
        try {
          const raw = await geminiGenerate(loaded.geminiApiKey, system, text, FAST_MODEL, undefined, true);
          const items = parseItems(raw);
          if (items.length) return items;
        } catch {
          // Fall through to NVIDIA.
        }
      }
      if (loaded.nvidiaApiKey) {
        try {
          return parseItems(await nvidiaGenerate(loaded.nvidiaApiKey, system, text));
        } catch {
          return [];
        }
      }
      return [];
    },
    async complete(system, prompt) {
      const loaded = await config();
      if (loaded.geminiApiKey) {
        try {
          return await geminiGenerate(loaded.geminiApiKey, system, prompt, FAST_MODEL);
        } catch {
          // Fall through to NVIDIA.
        }
      }
      if (loaded.nvidiaApiKey) return nvidiaGenerate(loaded.nvidiaApiKey, system, prompt);
      throw new ProviderError("Add a Gemini or NVIDIA API key in Profile to use AI suggestions.");
    },
    async tagLink({ url, title, text }) {
      const loaded = await config();
      const system =
        'You tag saved links so they are easy to search later. Return ONLY JSON {"tags":["..."]} with 4-8 short lowercase topic tags (specific technologies, use cases, tool types; hyphenate multi-word tags). No generic words like "website" or "link".';
      const prompt = `URL: ${url}
Title: ${title}
Content:
${maskSensitive(text).slice(0, 2500)}`;
      const parse = (raw: string) => {
        const parsed = extractJson(raw) as { tags?: unknown } | null;
        return Array.isArray(parsed?.tags) ? parsed.tags.map(String) : [];
      };
      if (loaded.geminiApiKey) {
        try {
          return parse(await geminiGenerate(loaded.geminiApiKey, system, prompt, FAST_MODEL, undefined, true));
        } catch {
          // Fall through to NVIDIA.
        }
      }
      if (loaded.nvidiaApiKey) {
        try {
          return parse(await nvidiaGenerate(loaded.nvidiaApiKey, system, prompt));
        } catch {
          return [];
        }
      }
      return [];
    },
    fetchMetadata: fetchLinkMetadata,
  };
}
