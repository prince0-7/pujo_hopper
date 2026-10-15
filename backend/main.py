import json
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().with_name(".env"))

if __package__:
    from .pandal_data import PANDALS_DB
    from .routing import TOMTOM_API_KEY, get_road_leg_details, optimize_pandal_route
    from .schemas import (
        ApiPandal,
        ApiRouteLeg,
        ApiRoutePlan,
        ApiRouteRequest,
        ApiLatLng,
        Pandal,
        RouteRequest,
        RouteResponse,
    )
else:
    from pandal_data import PANDALS_DB
    from routing import TOMTOM_API_KEY, get_road_leg_details, optimize_pandal_route
    from schemas import (
        ApiPandal,
        ApiRouteLeg,
        ApiRoutePlan,
        ApiRouteRequest,
        ApiLatLng,
        Pandal,
        RouteRequest,
        RouteResponse,
    )

app = FastAPI(
    title="Durga Puja Pandal Router API",
    description="Road-distance routing across West Bengal's major Durga Puja pandals.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_ZONES = {
    "south",
    "central",
    "north",
    "east_dumdum",
    "howrah_hooghly",
    "districts",
}
ALL_ZONES = VALID_ZONES | {"all"}

DIRECTORY_PATH = Path(__file__).resolve().parent.parent / "src" / "mocks"
with (DIRECTORY_PATH / "pandals.json").open(encoding="utf-8") as pandals_file:
    FRONTEND_PANDALS = json.load(pandals_file)
with (DIRECTORY_PATH / "directoryPandals.json").open(encoding="utf-8") as directory_file:
    FRONTEND_PANDALS.extend(json.load(directory_file))

@app.get("/")
def home():
    return {"message": "Pandal Router API is active and optimized."}


@app.get("/api/status")
def get_api_status():
    return {
        "trafficProvider": "tomtom" if TOMTOM_API_KEY else "estimated",
        "roadGeometryProvider": "osrm",
    }

@app.get("/pandals", response_model=List[Pandal])
def get_pandals(zone: Optional[str] = Query(None, description="Filter zone: south, central, north, east_dumdum, howrah_hooghly, districts")):
    if zone:
        selected_zone = zone.lower()
        if selected_zone not in ALL_ZONES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid zone '{zone}'. Valid zones are: {', '.join(sorted(ALL_ZONES))}.",
            )
        if selected_zone == "all":
            return PANDALS_DB
        return [pandal for pandal in PANDALS_DB if pandal["zone"] == selected_zone]
    return PANDALS_DB


@app.get("/api/pandals", response_model=List[ApiPandal])
def get_frontend_pandals(zone: Optional[str] = Query(None)):
    if not zone or zone.lower() == "all":
        return FRONTEND_PANDALS
    selected_zone = zone.casefold()
    return [
        pandal for pandal in FRONTEND_PANDALS
        if pandal["zone"].casefold() == selected_zone
    ]


@app.post("/api/routes/plan", response_model=ApiRoutePlan)
def plan_frontend_route(request: ApiRouteRequest):
    pandals_by_id = {pandal["id"]: pandal for pandal in FRONTEND_PANDALS}
    missing_ids = [pandal_id for pandal_id in request.pandal_ids if pandal_id not in pandals_by_id]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown pandal IDs: {', '.join(missing_ids)}",
        )

    selected = [pandals_by_id[pandal_id] for pandal_id in request.pandal_ids]
    optimizer_pandals = [
        {
            "id": index,
            "name": pandal["name"],
            "latitude": pandal["lat"],
            "longitude": pandal["lng"],
        }
        for index, pandal in enumerate(selected)
    ]
    result = optimize_pandal_route(
        start_loc=(request.origin.lat, request.origin.lng),
        pandals=optimizer_pandals,
        preference=request.preference,
    )

    ordered_stops = [
        selected[step["pandal_id"]].copy()
        for step in result["pandal_sequence"]
    ]
    legs = []
    previous = request.origin
    locations = [
        (request.origin.lat, request.origin.lng),
        *((pandal["lat"], pandal["lng"]) for pandal in ordered_stops),
    ]
    geometries, directions = get_road_leg_details(locations)
    for index, (step, pandal) in enumerate(
        zip(result["pandal_sequence"], ordered_stops)
    ):
        destination = ApiLatLng(lat=pandal["lat"], lng=pandal["lng"])
        distance_km = step["distance_from_prev_km"]
        duration_min = step["estimated_time_mins"]
        legs.append(
            ApiRouteLeg(
                **{
                    "from": previous,
                    "to": destination,
                    "distanceKm": distance_km,
                    "durationMin": duration_min,
                    "trafficLevel": step["traffic_level"],
                    "geometry": geometries[index],
                    "steps": directions[index],
                }
            )
        )
        previous = destination

    return ApiRoutePlan(
        **{
            "totalDistanceKm": result["total_distance_km"],
            "totalDurationMin": result["total_time_mins"],
            "orderedStops": ordered_stops,
            "legs": legs,
            "trafficSource": result["traffic_source"],
            "preference": result["preference"],
        }
    )

@app.post("/calculate-route", response_model=RouteResponse)
def calculate_route(request: RouteRequest):
    selected_zone = request.zone.strip().lower()

    if selected_zone == "all":
        target_pandals = PANDALS_DB
    elif selected_zone in VALID_ZONES:
        target_pandals = [pandal for pandal in PANDALS_DB if pandal["zone"] == selected_zone]
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid zone '{request.zone}'. Valid zones are: {', '.join(sorted(ALL_ZONES))}."
        )

    if not target_pandals:
        raise HTTPException(status_code=404, detail="No pandals available for the requested parameters.")

    result = optimize_pandal_route(
        start_loc=(request.user_location.latitude, request.user_location.longitude),
        pandals=target_pandals,
        traffic_multiplier=request.traffic_multiplier,
        max_pandals=request.max_pandals
    )

    return RouteResponse(
        total_distance_km=result["total_distance_km"],
        total_time_mins=result["total_time_mins"],
        pandal_sequence=result["pandal_sequence"]
    )