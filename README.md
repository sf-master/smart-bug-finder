## Smart Bug Finder – System Overview

This document captures the current architecture, data flow, and operational considerations for the Smart Bug Finder project. The goal is to provide developers with a single reference for how the frontend and backend interact, how the Playwright + Groq pipeline works, and what is required to run or extend the system.

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
        │                                   │ 4. Call llmHelper (Groq)    │
        │                                   └──────────┬──────────────────┘
        │                                             │
        │                                             ▼
        │                                   ┌─────────────────────────────┐
        │                                   │ Groq LLM (API)              │
        │                                   │  • Model: configurable      │
        │                                   │  • Endpoint: Responses API  │
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

- **Stack**: Node.js (ESM), Express, Playwright (Chromium), dotenv, cors, body-parser.
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
- **llmHelper (Groq)**
  - Environment variables:
    - `GROQ_API_KEY` (required)
    - `GROQ_MODEL` (default `openai/gpt-oss-20b`)
  - Builds a textual prompt summarizing DOM, console errors, network issues, and screenshot size.
  - Calls Groq’s OpenAI-compatible Responses API with `temperature: 0.2`.
  - Parses `response.output_text` into `{bugs, fixes, suggestions}`; returns fallback if parsing fails or request errors.

---

### 4. Environment & Dependencies

**Frontend**
- `npm install` inside `client/`
- Node 18+ recommended (Vite 5).
- Environment variables (optional):
  - `VITE_API_BASE_URL`: API server URL for production builds
    - Development: Leave unset to use Vite proxy (`http://localhost:5050`)
    - Production: Set to your API server URL (e.g., `http://0.0.0.0:5050` or `https://api.example.com`)
  - `VITE_PROXY_TARGET`: Override proxy target in development (defaults to `http://localhost:5050`)

**Backend**
- `npm install` inside `server/`
- `.env` template:
  ```
  PORT=5050
  CLIENT_ORIGIN=http://localhost:5173
  GROQ_API_KEY=sk_your_groq_key
  GROQ_MODEL=openai/gpt-oss-20b
  ```
- Environment variables:
  - `PORT`: Server port (default: 5050)
  - `CLIENT_ORIGIN`: Client URL for CORS (default: `http://localhost:5173`)
- Requires local Playwright dependencies (`npx playwright install chromium`).
- No local model runtime required.

---

### 5. Local Development Workflow

1. **Backend**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   Ensure `GROQ_API_KEY` is set and valid.

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
  - Provide `GROQ_API_KEY` securely (env/secret manager). The abstraction in `llmHelper` is the integration point if swapping providers.
  - Use HTTPS and proper authentication if exposing `/api/scan` publicly to avoid abuse.
  - Consider queueing or rate-limiting scans; Playwright launches can be resource-intensive.

- **Frontend**:
  - Static hosting (Vercel, Netlify, S3/CloudFront, etc.) or integrated with backend.
  - Set `VITE_API_BASE_URL` environment variable to your production API URL (e.g., `https://api.example.com`).
  - The client will use this URL directly instead of the Vite proxy.

- **Observability**:
  - Add structured logging for Playwright events and LLM responses for debugging.
  - Monitor Groq API usage/errors and rate limits.
  - Consider storing scan history if long-term audit trails are required.

---

### 7. Future Enhancements (Ideas)

- **Multi-model support**: Allow selecting different Groq models or add adapters for other hosted LLMs.
- **Queued scans**: For resource control, convert `/api/scan` into an async job with progress updates/WebSockets.
- **Authentication & roles**: Protect the scan endpoint from anonymous use if deployed externally.
- **Analytics storage**: Persist scan results for historical reporting or shareable dashboards.
- **CI/CD**: Add linting/tests (Jest/Playwright) and automated builds.

---

### 8. Quick Reference

| Component | Location | Notes |
|-----------|----------|-------|
| Vite config / proxy | `client/vite.config.js` | `/api` → `VITE_PROXY_TARGET` or `http://localhost:5050` |
| Router + pages | `client/src/App.jsx`, `client/src/pages/*` | Home & Results pages |
| Axios wrapper | `client/src/services/api.js` | `scanWebsite(url)` |
| Express server | `server/index.js` | CORS, routes, health |
| Scan controller | `server/controllers/scanController.js` | Playwright orchestration |
| LLM helper | `server/utils/llmHelper.js` | Groq prompt & parsing |
| README (frontend) | `client/README.md` | Dev instructions |
| README (backend) | `server/README.md` | Dev + env info |

Use this document to onboard new developers quickly and to keep the system context aligned as the project evolves.
