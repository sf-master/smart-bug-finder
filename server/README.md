## Smart Bug Finder Backend

Node.js + Express service that automates website scans with Playwright, collects DOM/screenshot/network data, and summarizes UI or accessibility issues via the **Groq** API (OpenAI-compatible Responses API).

### Features
- `GET /health` for uptime check.
- `GET /api/scan?url=...`:
  - Launches Playwright Chromium (headless).
  - Captures full DOM, console errors, network 4xx/5xx logs, and a full-page screenshot.
  - Sends collected data to Groq's Responses API for AI analysis.
  - Returns JSON `{ url, screenshot, bugs, fixes, suggestions, rawLLMResponse }`.

### Project Structure
```
server/
├── controllers/
│   └── scanController.js
├── routes/
│   └── scanRoute.js
├── utils/
│   └── llmHelper.js
├── index.js
├── package.json
└── .env (not committed)
```

### Environment Variables
Create `server/.env`:
```
PORT=5050                     # optional (defaults 5050)
GROQ_API_KEY=sk_your_groq_key
# Optional: override default model used for Groq
GROQ_MODEL=openai/gpt-oss-20b
```

### Installation & Development
```bash
cd server
npm install
npm run dev
```
- `npm run dev` starts Express on `PORT` (default `5050`) with CORS for `http://localhost:5173`.
- Ensure Playwright has downloaded Chromium (`npx playwright install chromium` if needed).

### API Workflow
1. Frontend calls `GET /api/scan?url=...`.
2. `scanController` runs a Playwright session to load the target URL, tracking console/network events and taking a screenshot.
3. `llmHelper.analyzeScanData` builds a prompt with DOM, errors, network issues, screenshot length.
4. Calls Groq's OpenAI-compatible Responses API (`responses.create`) and returns structured JSON (bugs, fixes, suggestions).
5. Response is sent back to the frontend; errors trigger 500 with message.

### Production Tips
- Run with a process manager (PM2, systemd) and set `NODE_ENV=production`.
- Consider Playwright’s `--disable-dev-shm-usage` option on low-memory servers.
- Harden CORS/HTTPS and secure the endpoint if exposed publicly.

### Troubleshooting
- **`Groq request failed` / Missing key**: set `GROQ_API_KEY` and ensure your account has access to the selected `GROQ_MODEL`.
- **`ERR_INVALID_URL` or Playwright timeout**: ensure `url` includes scheme (https://...); increase timeout if needed.
- **Playwright launch errors**: install dependencies (`npx playwright install chromium`) or enable sandbox permissions.
- **500 errors**: check server logs; the controller logs Playwright or LLM failures.

### License
[MIT](../LICENSE) (inherit from repository).
