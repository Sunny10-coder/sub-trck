# SubMind

SubMind is a local-first Expo app for subscriptions, accounts, saved links, prompts and reminders. The paper-style interface uses cream surfaces, bold outlines and colourful cards. Optional AI features use provider keys configured in Profile.

## Architecture

```text
Expo app (Android/iPhone/web)
  -> on-device storage (subscriptions, accounts, links, prompts)
  -> optional AI providers (extraction, summaries, chat and transcription)

Optional legacy service: FastAPI + MongoDB in backend/
```

The **Profile** screen manages your display name and Gemini, NVIDIA and OpenAI keys, plus Excel export and JSON backup/restore.

On Android/iOS, provider keys use secure storage. On web they are session-only. The mobile app does not require the legacy backend below.

## Run the app

```powershell
cd frontend
npm install
npm run web
# Checks (Node.js 24+ for the core test loader):
npm run typecheck
npm run test:core
```

Private workbook data and local API-key seeds are excluded from this public repository. Installation creates empty defaults without replacing existing local files. See [private-data setup](frontend/src/data/README.md). The local signed APK and backups remain on the owner's computer; they are not public release assets.

For Android, install a JDK and Android SDK, then use `npm run android` or `android/gradlew assembleRelease`. The optional debug signing key is generated locally during installation; use your own signing configuration for store distribution.

The backend instructions below apply only to the optional legacy service.

## 1. Start your backend on Windows

### Option A: Docker Desktop

From this repository root in PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Put the generated value in `backend\.env` as `SUBMIND_API_TOKEN`. Add `GEMINI_API_KEY` and `OPENAI_API_KEY` there only if you do not want to enter them in the phone Profile.

Then run this long-running command in your own terminal:

```powershell
docker compose up --build
```

MongoDB remains inside the private Compose network; FastAPI is available on port 8000.

### Option B: local Python plus your own MongoDB

Start MongoDB, copy `backend\.env.example` to `backend\.env`, and set `MONGO_URL`. Then:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn server:app --app-dir backend --host 0.0.0.0 --port 8000
```

The API docs are at `http://localhost:8000/docs`. Keep the server terminal running.

## 2. Run on your phone with Expo Go

1. Install **Expo Go** from Google Play or the iOS App Store.
2. Put the phone and PC on the same Wi-Fi network.
3. Find the PC's IPv4 address with `ipconfig` (for example `192.168.1.25`). Do **not** use `localhost` on the phone.
4. In a second PowerShell terminal:

```powershell
Set-Location frontend
yarn install
yarn start
```

5. Scan the QR code with Expo Go (Android) or the iPhone camera.
6. Open **Home → Profile** and enter:
   - backend URL: `http://YOUR_PC_IP:8000`;
   - app access token: the `SUBMIND_API_TOKEN` from `backend\.env`;
   - Gemini/OpenAI keys if they are not on the server.
7. Tap **Test**, then **Save profile**.

If the phone cannot connect, allow TCP port 8000 through Windows Firewall and check that the Wi-Fi network does not isolate devices. Plain HTTP is for trusted LAN development only.

## 3. Build an installable app

`frontend/eas.json` includes internal preview and production profiles. From `frontend`:

```powershell
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

EAS can build Android and iOS remotely from Windows. An iOS device build requires an Apple Developer account. Before store release:
- deploy the backend behind HTTPS (for example `https://api.your-domain.com`);
- set that URL in Profile or as the nonsecret `EXPO_PUBLIC_BACKEND_URL` build fallback;
- choose globally unique Android/iOS identifiers in `frontend/app.json`;
- build with the `production` profile.

## Configuration reference

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `MONGO_URL`, `DB_NAME` | Your Mongo database |
| `SUBMIND_API_TOKEN` | Bearer token protecting this single-owner API |
| `GEMINI_API_KEY` | Optional server-side Gemini fallback |
| `OPENAI_API_KEY` | Optional server-side transcription fallback |
| `GEMINI_FAST_MODEL`, `GEMINI_PRO_MODEL` | Gemini model choices |
| `OPENAI_STT_MODEL` | OpenAI transcription model |
| `CORS_ORIGINS` | Comma-separated browser origins; native apps do not rely on CORS |

### Frontend (`frontend/.env`)

Only `EXPO_PUBLIC_BACKEND_URL` is supported, and it is public. Never put API keys or the backend token in any `EXPO_PUBLIC_*` variable.

## Security note

This version is designed for one owner. It uses a static bearer token and the database identity `local`; it is not multi-user authentication. Do not share one deployment with unrelated users. Use HTTPS for any server reachable outside your LAN, rotate leaked keys/tokens, keep `.env` files uncommitted, and back up MongoDB before migrating old data.

## Validation commands

```powershell
Set-Location frontend
yarn typecheck
yarn lint
```

With the backend and a test Mongo database running:

```powershell
$env:SUBMIND_TEST_BASE_URL="http://127.0.0.1:8000"
$env:SUBMIND_API_TOKEN="your-token"
python -m pytest backend\tests -q
```
