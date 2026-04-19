# MyPins

MyPins now uses a React frontend (Vite) with the existing Express API backend.

## Stack

- Backend: Express (`app.js` / `server.js`)
- Frontend UI: React + Vite (`client/`)
- Data: local JSON files (`pins.json`, `users.json`, etc.)

## Run Locally

1. Install dependencies:

	npm install

2. Start backend API (port `3001`):

	npm run dev

3. In another terminal, start React UI dev server (port `5173`):

	npm run ui:dev

The Vite dev server proxies `/api`, `/IMG`, `/uploads`, and `/Style` to the backend.

## Build React UI

Build the React app:

npm run ui:build

Output is generated in `client/dist`.

## Serve React UI From Root Backend

After building, `npm start` serves:

- API routes from Express (`/api/*`)
- Built React app from `client/dist`

If `client/dist` is not present, backend falls back to legacy `index.html`.

## Deploy Frontend On Netlify (React)

This repo now includes `netlify.toml` so Netlify publishes the React app from `client/dist`.

Required Netlify settings:

1. Build command: `npm run ui:build`
2. Publish directory: `client/dist`

## Deploy Backend Separately

Netlify (static hosting) does not run your Express API by default. Deploy the backend (`app.js`) to a Node host such as Render, Railway, Fly.io, or any VPS.

Set this environment variable in Netlify:

`VITE_API_BASE_URL=https://your-backend-domain.com`

After setting it, trigger a new Netlify deploy so React calls:

- `https://your-backend-domain.com/api/...`

instead of trying to call `/api/...` on the Netlify domain.
