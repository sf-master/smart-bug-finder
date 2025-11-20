## Smart Bug Finder Backend

Node.js + Express service that automates website scans with Playwright, collects DOM/screenshot/network data, and summarizes UI or accessibility issues via an **Ollama** large-language model running locally (e.g., `llama3.1`). Designed to power the Smart Bug Finder frontend (`/client`).

### Features
- `GET /health` for uptime check.
- `GET /api/scan?url=...`:
  - Launches Playwright Chromium (headless).
  - Captures full DOM, console errors, network 4xx/5xx logs, and a full-page screenshot.
  - Sends collected data to an Ollama model (via `/api/generate`) for AI analysis.
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
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
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
4. Ollama (`/api/generate`, default `llama3.1`) returns structured JSON (bugs, fixes, suggestions).
5. Response is sent back to the frontend; errors trigger 500 with message.

### Production Tips
- Run with a process manager (PM2, systemd) and set `NODE_ENV=production`.
- Consider Playwright’s `--disable-dev-shm-usage` option on low-memory servers.
- Ensure the Ollama daemon stays running and preload the required model (`ollama run llama3.1` once).
- Harden CORS/HTTPS and secure the endpoint if exposed publicly.

### Troubleshooting
- **`Ollama request failed`**: verify the Ollama daemon is running (`ollama serve`) and the model in `.env` is pulled (`ollama pull llama3.1`).
- **`ERR_INVALID_URL` or Playwright timeout**: ensure `url` includes scheme (https://...); increase timeout if needed.
- **Playwright launch errors**: install dependencies (`npx playwright install chromium`) or enable sandbox permissions.
- **500 errors**: check server logs; the controller logs Playwright or LLM failures.

### License
[MIT](../LICENSE) (inherit from repository).

