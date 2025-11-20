## Smart Bug Finder – System Overview

This document captures the current architecture, data flow, and operational considerations for the Smart Bug Finder project. The goal is to provide developers with a single reference for how the frontend and backend interact, how the Playwright/Ollama pipeline works, and what is required to run or extend the system.

---

### 1. High-Level Architecture

```
┌──────────────┐      /api/scan?url=...      ┌─────────────────────────────┐
│ React Client │ ─────────────────────────▶ │ Express API (server/index)  │
└──────────────┘                            │  • CORS + JSON body parsing │
        ▲                                   │  • Routes mounted at /api   │
        │                                   └──────────┬──────────────────┘
        │                                             │
        │                                             ▼
        │                                   ┌─────────────────────────────┐
        │                                   │ scanController              │
        │                                   │ 1. Launch Playwright        │
        │                                   │ 2. Capture DOM/screenshot   │
        │                                   │ 3. Gather console/network   │
        │                                   │ 4. Call llmHelper (Ollama)  │
        │                                   └──────────┬──────────────────┘
        │                                             │
        │                                             ▼
        │                                   ┌─────────────────────────────┐
        │                                   │ Ollama LLM (local)          │
        │                                   │  • Model: configurable      │
        │                                   │  • Endpoint: /api/generate  │
        │                                   │  • Returns structured JSON  │
        │                                   └─────────────────────────────┘
        │
        │  JSON response: { screenshot, bugs, fixes, suggestions, ... }
        ▼
┌────────────────┐
│ React Results  │
└────────────────┘
```

---

### 2. Frontend (client/)

- **Stack**: React 18 + Vite, Tailwind CSS, React Router DOM, Axios.
- **Routing**:
  - `/`: Displays the homepage with hero text and `UrlInput` form.
  - `/results?url=...`: Parses the `url` query param, calls backend, renders results.
- **Vite Proxy**: `vite.config.js` proxies `/api` to `http://localhost:5050`, so Axios requests use relative paths both in dev and production (with reverse-proxy or server config).
- **Components**:
  - `Navbar`: simple top header.
  - `UrlInput`: handles form state and navigation to `/results`.
  - `Loader`: spinner while waiting for scan response.
  - `BugCard`: severity-tagged cards for each detected issue.
- **Fallback UX**: `Results` page uses sample data if the backend errors or times out, ensuring the UI remains populated even offline.
- **Build**: `npm run build` outputs `dist/`; `npm run preview` for local preview of production bundle.

---

### 3. Backend (server/)

- **Stack**: Node.js (ESM), Express, Playwright (Chromium), Axios, dotenv, cors, body-parser.
- **Entrypoint**: `server/index.js`
  - Loads `.env`.
  - Enables CORS for `http://localhost:5173` (adjust as needed in production).
  - Mounts `/api` routes (`scanRoute`), exposes `/health` for uptime checks.
- **Route Flow**:
  - `GET /api/scan?url=...`
    - Validates `url`.
    - Launches Playwright Chromium (headless) with viewport 1280×720 and HTTPS ignore for self-signed certs.
    - Attaches event listeners to:
      - `page.on('console')` to log errors with location.
      - `page.on('response')` to capture failing requests (status ≥400).
    - Navigates to the target URL, waits for load, and an extra 3s to settle.
    - Collects DOM via `page.content()` and screenshot (base64).
    - Calls `analyzeScanData` (llmHelper) and returns combined JSON:
      ```json
      {
        "url": "...",
        "screenshot": "<base64>",
        "bugs": [],
        "fixes": [],
        "suggestions": [],
        "rawLLMResponse": {}
      }
      ```
    - Ensures browser closes on both success and error paths.
- **llmHelper (Ollama)**
  - Environment variables:
    - `OLLAMA_BASE_URL` (default `http://localhost:11434`)
    - `OLLAMA_MODEL` (default `llama3.1` but any pulled model works, e.g., `phi3:mini`)
  - Builds a textual prompt summarizing DOM, console errors, network issues, and screenshot size.
  - Calls Ollama’s `/api/generate` with `stream: false` and `temperature: 0.2`.
  - Parses the JSON response (`response.data.response`) into `{bugs, fixes, suggestions}`; returns fallback if parsing fails or request errors.

---

### 4. Environment & Dependencies

**Frontend**
- `npm install` inside `client/`
- Node 18+ recommended (Vite 5).
- No env vars required by default.

**Backend**
- `npm install` inside `server/`
- `.env` template:
  ```
  PORT=5050
  OLLAMA_BASE_URL=http://127.0.0.1:11434
  OLLAMA_MODEL=phi3:mini   # or llama3.1, etc.
  ```
- Requires local Playwright dependencies (`npx playwright install chromium`).
- Requires a running Ollama daemon with the specified model pulled:
  ```
  ollama serve
  ollama pull phi3:mini
  ```

---

### 5. Local Development Workflow

1. **Backend**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   Ensure `ollama serve` runs in another terminal and the chosen model is available.

2. **Frontend**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Access via `http://localhost:5173`. The proxy automatically routes `/api/*` calls to the backend.

3. **Testing scans**: On the home page, enter any URL (with scheme, e.g., `https://example.com`). The results page should display loader → real data or fallback.

---

### 6. Deployment Considerations

- **Backend**:
  - Deploy on a Node-compatible host with Chrome/Playwright dependencies (or use Playwright’s Docker image).
  - Ensure Ollama is installed server-side or replace with a hosted LLM (OpenAI, etc.) if local inference isn’t desired. The abstraction in `llmHelper` is the main integration point.
  - Use HTTPS and proper authentication if exposing `/api/scan` publicly to avoid abuse.
  - Consider queueing or rate-limiting scans; Playwright launches can be resource-intensive.

- **Frontend**:
  - Static hosting (Vercel, Netlify, S3/CloudFront, etc.) or integrated with backend.
  - Update proxy / base API URL for production (e.g., set Vite’s `VITE_API_BASE_URL` if needed and adjust Axios).

- **Observability**:
  - Add structured logging for Playwright events and LLM responses for debugging.
  - Monitor Ollama logs for model load errors or memory constraints.
  - Consider storing scan history if long-term audit trails are required.

---

### 7. Future Enhancements (Ideas)

- **Multi-model support**: Allow selecting different Ollama models per request or fallback to a cloud LLM when local inference fails.
- **Queued scans**: For resource control, convert `/api/scan` into an async job with progress updates/WebSockets.
- **Authentication & roles**: Protect the scan endpoint from anonymous use if deployed externally.
- **Analytics storage**: Persist scan results for historical reporting or shareable dashboards.
- **CI/CD**: Add linting/tests (Jest/Playwright) and automated builds.

---

### 8. Quick Reference

| Component | Location | Notes |
|-----------|----------|-------|
| Vite config / proxy | `client/vite.config.js` | `/api` → `http://localhost:5050` |
| Router + pages | `client/src/App.jsx`, `client/src/pages/*` | Home & Results pages |
| Axios wrapper | `client/src/services/api.js` | `scanWebsite(url)` |
| Express server | `server/index.js` | CORS, routes, health |
| Scan controller | `server/controllers/scanController.js` | Playwright orchestration |
| LLM helper | `server/utils/llmHelper.js` | Ollama prompt & parsing |
| README (frontend) | `client/README.md` | Dev instructions |
| README (backend) | `server/README.md` | Dev + env info |

Use this document to onboard new developers quickly and to keep the system context aligned as the project evolves.

