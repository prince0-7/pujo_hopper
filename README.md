# Pandal Hopper

A Durga Puja pandal hopping planner for Kolkata with a React 18, Vite, TypeScript, Leaflet/OpenStreetMap, Zustand, Tailwind CSS, and Lucide frontend plus a FastAPI backend. The frontend can run standalone in mock mode or use the integrated backend.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Check a production bundle with `npm run build`; `npm run preview` serves that bundle locally.

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

The route request is `{ "origin": { "lat": 22.57, "lng": 88.36 }, "pandalIds": ["college-square"] }`. The backend orders stops using a nearest-neighbor TSP heuristic over the travel-time matrix. When `TOMTOM_API_KEY` is configured in the private `backend/.env`, TomTom supplies traffic-aware road distance and ETA; otherwise the backend uses straight-line estimates. OSRM is used separately for road-following route geometry when available, with direct segments as a geometry fallback. The response identifies `trafficSource` as `live` or `estimated`, and every leg receives a low/moderate/heavy traffic class.

Create `backend/.env` from `backend/.env.example` to enable live traffic. Keep real keys in the ignored `.env` file; do not put them in frontend variables or commit them. TomTom and the public OSRM demo service have their own availability, terms, and rate limits. PostgreSQL/PostGIS and a persisted road graph are not currently required: the pandal directory is local JSON, and shortest-road costs are delegated to the routing provider's matrix API rather than locally running Dijkstra over a cached graph.

Geolocation is requested only after the user chooses “Use my location.” Browsers may require HTTPS (or localhost) for geolocation. Choosing the approximate-location option uses Kolkata center coordinates.

The regional names and directory entries follow the supplied 2026 list. Added records use approximate map coordinates and illustrative crowd/theme metadata where the source did not provide those details. The radius control extends to 80 km so Kalyani and outlying entries can be explored; choosing Kalyani or Other areas widens the radius when needed.

## Notes

- OpenStreetMap tiles require an internet connection.
- Pandal image URLs are illustrative remote assets and should be replaced with verified, appropriately licensed photos before publication.
- Route geometry, traffic levels, and ETAs are mock estimates, not live navigation data.
