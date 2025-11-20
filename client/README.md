## Smart Bug Finder Frontend

Modern React + Vite interface for scanning websites and displaying AI-generated UI/accessibility bug reports. Users enter a URL, the app calls the backend scanner, shows screenshot previews, bug cards with severity, suggested fixes, and allows JSON downloads—with graceful fallback data when the backend is unreachable.

### Features
- URL input form with validation and “Scan Now” button.
- Results dashboard:
  - Screenshot preview container (max width 800px).
  - AI-generated bug list rendered via `BugCard`.
  - Suggested fixes list with JSON download button.
  - Loader state + sample/fallback results when `/api/scan` fails.
- Responsive Tailwind design and React Router pages (`/` and `/results`).
- Axios service layer talking to the backend via Vite proxy (`/api` → `http://localhost:5050`).

### Project Structure
```
client/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── UrlInput.jsx
│   │   ├── BugCard.jsx
│   │   └── Loader.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   └── Results.jsx
│   └── services/
│       └── api.js
```

### Environment Variables
No frontend-specific env vars. Vite’s dev proxy (configured in `vite.config.js`) forwards `/api/*` to `http://localhost:5050`.

### Installation
```bash
cd client
npm install
npm run dev
```
The dev server runs on `http://localhost:5173` and proxies API calls to the backend.

### Backend Communication
- All scans call `GET /api/scan?url={encodedUrl}`.
- Ensure the backend (Express + Playwright service) is running on `http://localhost:5050`.
- Vite proxy handles cross-origin requests automatically in development.

### Screenshots
_Add UI screenshots or GIFs here (home page, results dashboard, bug cards, loader)._

### Technologies Used
- React 18 + Vite 5
- Tailwind CSS 3
- Axios
- React Router DOM
- Vite proxy for backend communication

### Production Build
```bash
npm run build
npm run preview   # optional preview of the production bundle
```
Deploy the generated `dist/` folder to your hosting provider of choice.

### Troubleshooting
- **API 500 error**: Backend scan failed; UI shows fallback data. Inspect backend logs (Playwright or LLM issues).
- **Backend not running**: `/api/scan` will fail until `npm run dev` is running in `/server`.
- **CORS issues**: Use the Vite proxy (`/api`). Directly hitting `http://localhost:5050` from the browser may trigger CORS errors if backend CORS isn’t configured for your origin.

### License
MIT License.

