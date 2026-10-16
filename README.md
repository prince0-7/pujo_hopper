# Pandal Hopper

A Durga Puja pandal hopping planner for Kolkata with a React 18, Vite, TypeScript, Leaflet/OpenStreetMap, Zustand, Tailwind CSS, and Lucide frontend plus a FastAPI backend. The frontend can run standalone in mock mode or use the integrated backend.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Check a production bundle with `npm run build`; `npm run preview` serves that bundle locally.

## Deploy to Vercel

Import this repository into Vercel with the project root as the Root Directory. The checked-in `vercel.json` builds the Vite app into `dist` and rewrites client-side routes to `index.html`. The `build:vercel` script disables mock data and points the frontend at same-origin Python functions for `/api/pandals`, `/api/status`, and `/api/routes/plan`. Python dependencies are installed from the root `requirements.txt`.

To enable live TomTom traffic, add `TOMTOM_API_KEY` in the Vercel project's Settings → Environment Variables, enabled for the Production environment (and Preview if desired), then redeploy. Keep it as a server-side variable: do not add it to a `VITE_` variable or commit it. If the key is not configured or TomTom is unavailable, driving routes continue to use the existing non-live routing fallback. The route-planning function is configured for up to 60 seconds; this is subject to the limits of the Vercel plan.

## Run frontend and backend together

Install backend dependencies once, then launch both servers from the project root:

```bash
python -m pip install -r backend/requirements.txt
npm install
npm run dev:full
```

The frontend opens at `http://127.0.0.1:5173`; FastAPI is at `http://127.0.0.1:8000` and its interactive docs are at `/docs`. The full-stack script disables mocks for that Vite process and starts both services together. Use Ctrl+C to stop both.

To run only FastAPI, use `python -m uvicorn backend.main:app --reload --port 8000` from the project root. To run only the standalone frontend, use `npm run dev`; mock mode is enabled by default.

## Project scaffolding

The project was scaffolded with Vite, then dependencies were added:

```bash
npm create vite@latest . -- --template react-ts
npm install react@18 react-dom@18 leaflet react-leaflet@4 zustand lucide-react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D tailwindcss@3 postcss autoprefixer @types/leaflet @types/react@18 @types/react-dom@18
```

## Mock data and API

- `src/mocks/pandals.json` and `src/mocks/directoryPandals.json` provide the combined North, South, Central, Salt Lake, Kalyani, and Other areas directory.
- `src/services/api.ts` owns `getPandals` and `planRoute`, including simulated latency and the nearest-neighbor route mock.
- `src/types/index.ts` defines the service and UI data contracts.
- `backend/main.py` exposes `/api/pandals`, `/api/routes/plan`, and `/api/status` using the same checked-in JSON directory. Legacy `/pandals` and `/calculate-route` endpoints remain available.
- `VITE_API_BASE_URL` configures the API prefix and defaults to `http://127.0.0.1:8000/api`. `VITE_USE_MOCK` defaults to `true`; set it to `false` to use FastAPI. `npm run dev:full` sets it to `false` automatically.

The route request accepts `travelMode` values `walking`, `driving`, `cycling`, `motorcycle`, and `transit`. Walking, cycling, and motorcycle use Valhalla's pedestrian, bicycle, and motorcycle routing profiles; driving uses TomTom when `TOMTOM_API_KEY` is configured, otherwise OSRM's road matrix. If routing is unavailable, fallback durations use mode-specific average speeds (walking 4.8 km/h, driving 20 km/h, cycling 15 km/h, motorcycle 25 km/h). Transit is an estimate using 18 km/h plus a 10-minute per-leg boarding/transfer allowance; open Google Maps from Directions for live transit routes and schedules. Estimated durations round up to whole minutes. Driving travel time incorporates traffic only when TomTom is configured: its traffic-aware `travelTimeInSeconds` is the ETA used for route selection, while `trafficDelayInSeconds` classifies each leg as low/moderate/heavy. OSRM and Valhalla provide typical route durations, not live traffic; when TomTom is unavailable the UI says live traffic is unavailable instead of inventing a traffic level. Fastest and shortest are compared side by side using the selected mode's travel-time or distance matrix.

Create `backend/.env` from `backend/.env.example` to enable live traffic or override `VALHALLA_URL`. Keep real keys in the ignored `.env` file; do not put them in frontend variables or commit them. TomTom and the public OSRM/Valhalla demo services have their own availability, terms, and rate limits. PostgreSQL/PostGIS and a persisted road graph are not currently required: the pandal directory is local JSON, and road costs are delegated to the routing providers' matrix APIs rather than locally running Dijkstra over a cached graph.

Geolocation is requested only after the user chooses “Use my location.” Browsers may require HTTPS (or localhost) for geolocation. Choosing the approximate-location option uses Kolkata center coordinates.

The regional names and directory entries follow the supplied 2026 list. Crowd levels are illustrative estimates, not a live crowd feed; added records may also use approximate map coordinates and illustrative theme metadata where the source did not provide those details. The radius control extends to 80 km so Kalyani and outlying entries can be explored; choosing Kalyani or Other areas widens the radius when needed.

## Notes

- OpenStreetMap tiles require an internet connection.
- Named pandals with verified Wikimedia Commons photos show the photographer, license, and source link in the popup. Other entries use a clearly labeled local illustration until a relevant photo can be verified.
- Route geometry, traffic levels, and ETAs are mock estimates, not live navigation data.
