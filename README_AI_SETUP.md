# Solo System + AI Mentor (complete source package)

This package preserves the existing Solo System app (F-rank, XP, E–SS dungeons, quests, daily preview, mock logs, reports, backup/import) and adds:

- Natural text AI chat inside the app
- PNG/JPG/WEBP question photo upload for step-by-step explanations
- Hinglish/Hindi/English preference and teaching-style setting
- Two-way real-time voice calls using WebRTC, with an animated orb/avatar
- Optional browser speech playback for the last text reply
- Existing progress remains in the same `soloSystemSaveV1` localStorage key; AI chat/preferences use separate keys
- Backend keeps the permanent API key server-side; browser receives only a short-lived Realtime client secret

## Important: this is a source package, not a deployed AI service

GitHub Pages can host the static frontend but cannot run `server/server.js`. The AI endpoints will not work until you deploy the backend to a Node.js host and set the frontend API base URL if frontend/backend are hosted on different origins. The default frontend calls relative `/api/...`, so the simplest production setup is to host the static frontend and API together behind the same domain, or set `window.AI_API_BASE="https://YOUR-BACKEND-DOMAIN";` in the `<head>` of `index.html` before the app script, set ``ALLOWED_ORIGINS`` on the backend to the exact GitHub Pages origin, and redeploy.

### 1. Run the backend locally

1. Install Node.js 20+.
2. In a terminal, open the `server` folder and run `npm install`.
3. Copy `.env.example` to `.env` and put your API key in `OPENAI_API_KEY` in that server-only file. Never paste the secret into `index.html`, GitHub, or a public repository.
4. Run `npm start`.
5. For local development, serve the frontend through a local web server and configure it to use `http://localhost:3000` as the API base, or serve the `public` folder from the backend.

### 2. Deploy

- Deploy `server/` to a Node.js hosting service that supports environment variables and HTTPS.
- Add `OPENAI_API_KEY` in the host's secret/environment settings. Do not commit `.env`.
- Set `OPENAI_CHAT_MODEL`, `OPENAI_REALTIME_MODEL`, and `OPENAI_VOICE` to models/voices available to your API project.
- For same-origin deployment, put `index.html` and static assets in `public/`; the backend serves that folder. Copy `index.html` into `server/public/index.html` or configure your host to serve the root frontend.
- If frontend stays on GitHub Pages, add `window.AI_API_BASE="https://YOUR-BACKEND-DOMAIN";` in the `<head>` of `index.html` before the app script and set ``ALLOWED_ORIGINS`` to the exact GitHub Pages origin. Never use wildcard CORS. Do not use wildcard CORS for a public production service.
- Add rate limits, usage limits, and authentication before sharing publicly. This starter includes a basic per-IP rate limit, but it is not sufficient to protect an unrestricted public API from abuse.

### 3. Voice and photos

- Live voice needs HTTPS (localhost is okay for development), microphone permission, a supported browser, and Realtime API access. API usage may cost money.
- The AI requests Indian-English pronunciation where supported; an exact Indian regional accent is not guaranteed by the provider.
- The photo feature sends the selected image to the AI provider for analysis. Do not upload private or sensitive documents.
- AI replies can be wrong. Verify legal/current-affairs facts and use explanations as study support, not professional legal advice.

### 4. Keep your progress

Your old study progress remains in the same localStorage key. Before replacing a deployed app, use Settings → Export backup. Do not click Reset. Browser-local data is not automatically synced between devices. The chat is stored separately on the same device and can be cleared without deleting quests or XP.

### 5. Troubleshooting

- `AI backend is not configured`: add `OPENAI_API_KEY` to backend environment variables and restart/redeploy.
- `Failed to fetch`: frontend cannot reach `/api`. Host on same origin or set `AI_API_BASE` to the backend URL and configure CORS.
- `Realtime API unavailable`: check API project access, available model/voice names, usage limits and billing.
- Microphone denied: allow microphone permission for the HTTPS site.

## Files

- `index.html`: updated app frontend
- `server/server.js`: secure API endpoints for text/image chat and short-lived voice credentials
- `server/package.json`: backend dependencies
- `server/.env.example`: environment variable template (contains no real secret)
