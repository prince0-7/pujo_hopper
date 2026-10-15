import math
import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

import requests


TOMTOM_MATRIX_URL = "https://api.tomtom.com/routing/1/matrix/sync/json"
OSRM_ROUTE_URL = os.getenv(
    "OSRM_ROUTE_URL", "https://router.project-osrm.org/route/v1/driving"
)
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY")
MATRIX_TIMEOUT_SECONDS = 20.0
GEOMETRY_TIMEOUT_SECONDS = 8.0
FALLBACK_SPEED_KMH = 20.0


class MatrixRoutingUnavailableError(RuntimeError):
    """Raised when TomTom cannot provide a complete routing matrix."""


def _coordinates(pandal: Dict[str, Any]) -> Tuple[float, float]:
    return float(pandal["latitude"]), float(pandal["longitude"])


def _haversine_distance(
    first: Tuple[float, float], second: Tuple[float, float]
) -> float:
    latitude_1, longitude_1 = first
    latitude_2, longitude_2 = second
    earth_radius_km = 6371.0
    delta_latitude = math.radians(latitude_2 - latitude_1)
    delta_longitude = math.radians(longitude_2 - longitude_1)
    haversine = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(math.radians(latitude_1))
        * math.cos(math.radians(latitude_2))
        * math.sin(delta_longitude / 2) ** 2
    )
    return 2 * earth_radius_km * math.atan2(
        math.sqrt(haversine), math.sqrt(1 - haversine)
    )


def _get_tomtom_matrix(
    locations: Sequence[Tuple[float, float]],
    route_type: str = "fastest",
) -> Tuple[List[List[float]], List[List[float]], List[List[float]]]:
    if not TOMTOM_API_KEY:
        raise MatrixRoutingUnavailableError("TOMTOM_API_KEY is not configured")

    points = [
        {"point": {"latitude": latitude, "longitude": longitude}}
        for latitude, longitude in locations
    ]
    request_body = {"origins": points, "destinations": points}
    try:
        response = requests.post(
            TOMTOM_MATRIX_URL,
            params={
                "key": TOMTOM_API_KEY,
                "routeType": route_type,
                "traffic": "true",
            },
            json=request_body,
            timeout=MATRIX_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        raise MatrixRoutingUnavailableError("TomTom matrix request failed") from error

    if not isinstance(payload, dict):
        raise MatrixRoutingUnavailableError("TomTom returned an invalid response")

    try:
        expected_size = len(locations)
        distances: List[List[Optional[float]]] = [
            [None] * expected_size for _ in range(expected_size)
        ]
        durations: List[List[Optional[float]]] = [
            [None] * expected_size for _ in range(expected_size)
        ]
        traffic_delays: List[List[Optional[float]]] = [
            [0.0] * expected_size for _ in range(expected_size)
        ]

        if "matrix" in payload:
            matrix = payload["matrix"]
            if (
                len(matrix) != expected_size
                or any(len(row) != expected_size for row in matrix)
            ):
                raise ValueError("TomTom returned an incomplete routing matrix")
            matrix_entries = []
            for origin_index, row in enumerate(matrix):
                for destination_index, cell in enumerate(row):
                    if int(cell.get("statusCode", 0)) != 200:
                        raise ValueError("TomTom returned an unsuccessful matrix cell")
                    matrix_entries.append(
                        (
                            origin_index,
                            destination_index,
                            cell["response"]["routeSummary"],
                        )
                    )
        else:
            matrix_entries = [
                (
                    int(item["originIndex"]),
                    int(item["destinationIndex"]),
                    item["routeSummary"],
                )
                for item in payload["data"]
            ]

        for origin_index, destination_index, summary in matrix_entries:
            distance_m = float(summary["lengthInMeters"])
            duration_s = float(summary["travelTimeInSeconds"])
            traffic_delay_s = float(summary.get("trafficDelayInSeconds", 0.0))
            if not (0 <= origin_index < expected_size):
                raise ValueError("TomTom returned an invalid origin index")
            if not (0 <= destination_index < expected_size):
                raise ValueError("TomTom returned an invalid destination index")
            if (
                not math.isfinite(distance_m)
                or distance_m < 0
                or not math.isfinite(duration_s)
                or duration_s < 0
                or not math.isfinite(traffic_delay_s)
                or traffic_delay_s < 0
            ):
                raise ValueError("TomTom returned invalid distance or duration values")
            distances[origin_index][destination_index] = distance_m
            durations[origin_index][destination_index] = duration_s
            traffic_delays[origin_index][destination_index] = traffic_delay_s

        if any(value is None for row in distances for value in row) or any(
            value is None for row in durations for value in row
        ):
            raise ValueError("TomTom returned an incomplete routing matrix")

        return (
            [[float(value) for value in row] for row in distances],
            [[float(value) for value in row] for row in durations],
            [[float(value) for value in row] for row in traffic_delays],
        )
    except (KeyError, TypeError, ValueError) as error:
        raise MatrixRoutingUnavailableError(
            "TomTom returned an invalid routing matrix"
        ) from error


def _fallback_matrices(
    locations: Sequence[Tuple[float, float]],
) -> Tuple[List[List[float]], List[List[float]], List[List[float]]]:
    distances = [
        [_haversine_distance(origin, destination) * 1000 for destination in locations]
        for origin in locations
    ]
    durations = [
        [distance / (FALLBACK_SPEED_KMH * 1000 / 3600) for distance in row]
        for row in distances
    ]
    traffic_delays = [[0.0 for _ in row] for row in distances]
    return distances, durations, traffic_delays


def _maneuver_instruction(maneuver: Dict[str, Any], road_name: str) -> str:
    maneuver_type = str(maneuver.get("type", "continue")).replace("_", " ")
    modifier = str(maneuver.get("modifier", "")).replace("_", " ")
    road = road_name or "the road"

    if maneuver_type == "depart":
        return f"Head {modifier} on {road}" if modifier else f"Head onto {road}"
    if maneuver_type == "arrive":
        return "Arrive at your destination"
    if maneuver_type == "turn":
        return f"Turn {modifier} onto {road}" if modifier else f"Turn onto {road}"
    if maneuver_type == "roundabout":
        return f"Enter the roundabout and continue onto {road}"
    if maneuver_type == "merge":
        return f"Merge onto {road}"
    if maneuver_type == "fork":
        return f"Keep {modifier} at the fork onto {road}" if modifier else f"Keep at the fork onto {road}"
    if maneuver_type == "end of road":
        return f"At the end of the road, turn {modifier} onto {road}" if modifier else f"Continue onto {road}"
    if maneuver_type == "continue":
        return f"Continue on {road}"
    return f"{maneuver_type.capitalize()} on {road}"


def get_road_leg_details(
    locations: Sequence[Tuple[float, float]],
) -> Tuple[List[List[List[float]]], List[List[Dict[str, Any]]]]:
    """Fetch road geometry and maneuvers, with direct-route fallback."""
    fallback = [
        [[origin[0], origin[1]], [destination[0], destination[1]]]
        for origin, destination in zip(locations, locations[1:])
    ]
    if len(locations) < 2:
        return [], []

    coordinates = ";".join(
        f"{longitude},{latitude}" for latitude, longitude in locations
    )
    try:
        response = requests.get(
            f"{OSRM_ROUTE_URL}/{coordinates}",
            params={
                "overview": "false",
                "steps": "true",
                "geometries": "geojson",
            },
            headers={"User-Agent": "PandalRouter/1.0"},
            timeout=GEOMETRY_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        route_legs = payload["routes"][0]["legs"]
        if len(route_legs) != len(fallback):
            raise ValueError("OSRM returned an unexpected number of route legs")

        geometries: List[List[List[float]]] = []
        directions: List[List[Dict[str, Any]]] = []
        for leg, direct_geometry in zip(route_legs, fallback):
            points: List[List[float]] = []
            leg_directions: List[Dict[str, Any]] = []
            for step in leg.get("steps", []):
                geometry = step.get("geometry", {})
                for longitude, latitude in geometry.get("coordinates", []):
                    point = [float(latitude), float(longitude)]
                    if not points or point != points[-1]:
                        points.append(point)
                maneuver = step.get("maneuver", {})
                longitude, latitude = maneuver.get("location", [0.0, 0.0])
                leg_directions.append(
                    {
                        "instruction": _maneuver_instruction(
                            maneuver, str(step.get("name", ""))
                        ),
                        "distance_km": round(float(step.get("distance", 0.0)) / 1000, 2),
                        "duration_min": round(float(step.get("duration", 0.0)) / 60, 1),
                        "location": {"lat": float(latitude), "lng": float(longitude)},
                    }
                )
            geometries.append(points if len(points) >= 2 else direct_geometry)
            if not leg_directions:
                leg_directions.append(
                    {
                        "instruction": "Continue along the planned route",
                        "distance_km": round(float(leg.get("distance", 0.0)) / 1000, 2),
                        "duration_min": round(float(leg.get("duration", 0.0)) / 60, 1),
                        "location": {"lat": locations[len(directions) + 1][0], "lng": locations[len(directions) + 1][1]},
                    }
                )
            directions.append(leg_directions)
        return geometries, directions
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError):
        directions = []
        for index, (origin, destination) in enumerate(zip(locations, locations[1:])):
            distance_km = _haversine_distance(origin, destination)
            directions.append(
                [
                    {
                        "instruction": "Continue along the planned route",
                        "distance_km": round(distance_km, 2),
                        "duration_min": round(distance_km / FALLBACK_SPEED_KMH * 60, 1),
                        "location": {"lat": destination[0], "lng": destination[1]},
                    }
                ]
            )
        return fallback, directions


def get_road_leg_geometries(
    locations: Sequence[Tuple[float, float]],
) -> List[List[List[float]]]:
    """Compatibility wrapper returning only road geometry."""
    return get_road_leg_details(locations)[0]


def _traffic_level(travel_time_s: float, traffic_delay_s: float, is_live: bool) -> str:
    if not is_live:
        return "moderate"
    free_flow_time_s = max(travel_time_s - traffic_delay_s, 1.0)
    delay_ratio = traffic_delay_s / free_flow_time_s
    if delay_ratio >= 0.45:
        return "heavy"
    if delay_ratio >= 0.15:
        return "moderate"
    return "low"


def optimize_pandal_route(
    start_loc: Tuple[float, float],
    pandals: List[Dict[str, Any]],
    traffic_multiplier: float = 1.0,
    max_pandals: Optional[int] = None,
    preference: str = "fastest",
) -> Dict[str, Any]:
    """Order stops with a nearest-neighbor TSP heuristic over road costs."""
    if preference not in {"fastest", "shortest"}:
        raise ValueError("preference must be 'fastest' or 'shortest'")
    target_pandals = pandals[:max_pandals] if max_pandals is not None else pandals
    if not target_pandals:
        return {
            "total_distance_km": 0.0,
            "total_time_mins": 0.0,
            "pandal_sequence": [],
            "traffic_source": "estimated",
            "preference": preference,
        }

    locations = [start_loc, *(_coordinates(pandal) for pandal in target_pandals)]
    is_live_traffic = bool(TOMTOM_API_KEY)
    try:
        distance_matrix, duration_matrix, traffic_delay_matrix = _get_tomtom_matrix(
            locations, route_type=preference
        )
    except MatrixRoutingUnavailableError:
        distance_matrix, duration_matrix, traffic_delay_matrix = _fallback_matrices(locations)
        is_live_traffic = False

    unvisited = set(range(1, len(locations)))
    current_index = 0
    total_distance_m = 0.0
    total_duration_s = 0.0
    sequence = []
    cost_matrix = distance_matrix if preference == "shortest" else duration_matrix

    while unvisited:
        next_index = min(
            unvisited, key=lambda index: cost_matrix[current_index][index]
        )
        distance_m = float(distance_matrix[current_index][next_index])
        duration_s = float(duration_matrix[current_index][next_index])
        traffic_delay_s = float(traffic_delay_matrix[current_index][next_index])
        pandal = target_pandals[next_index - 1]
        total_distance_m += distance_m
        total_duration_s += duration_s
        sequence.append(
            {
                "step_number": len(sequence) + 1,
                "pandal_id": pandal["id"],
                "name": pandal["name"],
                "latitude": pandal["latitude"],
                "longitude": pandal["longitude"],
                "distance_from_prev_km": round(distance_m / 1000, 2),
                "estimated_time_mins": round(
                    duration_s / 60 * traffic_multiplier, 1
                ),
                "traffic_level": _traffic_level(
                    duration_s, traffic_delay_s, is_live_traffic
                ),
            }
        )
        current_index = next_index
        unvisited.remove(next_index)

    return {
        "total_distance_km": round(total_distance_m / 1000, 2),
        "total_time_mins": round(total_duration_s / 60 * traffic_multiplier, 1),
        "pandal_sequence": sequence,
        "traffic_source": "live" if is_live_traffic else "estimated",
        "preference": preference,
    }