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

## Deploy Frontend On Vercel (React)

This repo now includes `vercel.json` so Vercel builds `client/dist` and proxies API/media requests to the backend.

Quick deploy:

1. Install Vercel CLI (one-time):

	npm i -g vercel

2. Deploy from the project root:

	vercel

3. Deploy to production:

	vercel --prod

Vercel build settings are already defined in `vercel.json`:

- Build command: `npm run ui:build`
- Output directory: `client/dist`
- Rewrites: `/api/*`, `/IMG/*`, and `/uploads/*` are proxied to `https://mypins.onrender.com`

## Deploy Backend Separately

Vercel static hosting does not run your Express API with persistent local JSON storage. Keep the backend (`app.js`) deployed to a Node host such as Render, Railway, Fly.io, or any VPS.

Optional environment variable on Vercel:

`VITE_API_BASE_URL=https://your-backend-domain.com`

If not set, the app will use same-origin `/api/*` first (handled by Vercel rewrites), then fallback to `https://mypins.onrender.com`.
