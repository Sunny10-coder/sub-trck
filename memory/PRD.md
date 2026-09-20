# SubMind — Product Requirements Document

## Product
SubMind is a personal Subscription Manager + AI Link Memory + Reminder Assistant. Inputs such as subscriptions, screenshots, shared links, offers, trials, and notes flow through extraction, classification, normalization, duplicate detection, confidence routing, storage, and reminders.

## Self-owned platform
- **Frontend:** Expo (React Native) + Expo Router
- **Backend:** FastAPI, owned and deployed by the user
- **Database:** MongoDB (Motor), owned by the user
- **AI:** Direct Gemini API calls using a key supplied in the native Profile or `GEMINI_API_KEY` on the backend
- **Speech-to-text:** Direct OpenAI transcription using a Profile key or `OPENAI_API_KEY` on the backend
- **Access:** Single-owner API protected with `SUBMIND_API_TOKEN`; this is not multi-user authentication
- **Secrets:** Native Profile secrets use Expo SecureStore. Public build variables contain only a fallback backend URL.
- **Deferred native capabilities:** Android notification listener, on-device OCR, and a native share target

## Architecture
- `backend/server.py` — FastAPI routes, Mongo access, ingest pipeline, CRUD, insights, search, graph, chat, comparison, settings, access-token enforcement, and CORS.
- `backend/ai_services.py` — direct Gemini and OpenAI adapters with request-scoped bring-your-own-key support and server environment fallbacks.
- `frontend/src/lib/client-config.ts` — local profile/connection configuration and native secret persistence.
- `frontend/src/lib/api.ts` — endpoint-aware API client; sends only the credentials needed by each route.
- `frontend/app/profile.tsx` — offline-loadable Profile for backend URL, owner token, provider keys, and connection testing.
- `frontend/app` — Expo Router tabs and secondary screens.

## Implemented
- Onboarding and first-run state.
- Home dashboard, spending insights, renewals, trials, and quick actions.
- Subscription CRUD, payment history, links, watchlist, reminders, smart inbox, search, and graph.
- Camera/photo extraction through Gemini vision.
- Grounded AI chat, plan comparison, and voice transcription.
- Profile with a configurable self-owned backend, secure native key storage, connection testing, and key removal.
- Settings for currency, AI processing, confidence thresholds, screenshot retention, monitoring, and onboarding reset.
- Expo Go development workflow and EAS preview/production build profiles.
- Docker Compose option for a private MongoDB plus FastAPI backend.

## Security boundaries
- The backend currently represents one owner as `user_id="local"`. The bearer token prevents casual public access but does not provide accounts or tenant isolation.
- A production deployment must use HTTPS. Provider keys entered on the phone are sent to the selected backend for that request and are never stored in MongoDB.
- Browser key storage is intentionally session-only; persistent BYOK is intended for native iOS/Android.
- Provider processing sends intentionally shared content to Gemini or OpenAI. Screenshot retention remains off by default.

## Backlog
### P1
- Replace static owner-token access with real user accounts and principal-derived ownership before supporting multiple people.
- Harden webpage enrichment against SSRF and add strict media/body-size limits before exposing a public server.
- Add asynchronous enrichment jobs and price monitoring.
- Add full subscription editing and semantic search.

### P2
- Android NotificationListenerService renewal/trial detection.
- On-device OCR before optional cloud AI.
- Native Android/iOS share destination.
- Offline mutation queue and background sync.
