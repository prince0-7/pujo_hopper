import logging
import math
import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

import requests


logger = logging.getLogger(__name__)
TOMTOM_MATRIX_URL = "https://api.tomtom.com/routing/1/matrix/sync/json"
OSRM_ROUTE_URL = os.getenv(
    "OSRM_ROUTE_URL", "https://router.project-osrm.org/route/v1/driving"
)
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY")
MATRIX_TIMEOUT_SECONDS = 30.0
TOMTOM_SYNC_MATRIX_MAX_CELLS = 100
GEOMETRY_TIMEOUT_SECONDS = 8.0
OSRM_TABLE_TIMEOUT_SECONDS = 8.0
OSRM_TABLE_URL = os.getenv(
    "OSRM_TABLE_URL", OSRM_ROUTE_URL.replace("/route/v1/", "/table/v1/")
)
VALHALLA_URL = os.getenv("VALHALLA_URL", "https://valhalla1.openstreetmap.de").rstrip("/")
VALHALLA_TIMEOUT_SECONDS = 12.0
VALHALLA_COSTING = {
    "walking": "pedestrian",
    "driving": "auto",
    "cycling": "bicycle",
    "motorcycle": "motorcycle",
    "transit": "pedestrian",
}
FALLBACK_SPEEDS_KMH = {
    "walking": 4.8,
    "driving": 20.0,
    "cycling": 15.0,
    "motorcycle": 25.0,
    "transit": 18.0,
}
RouteMatrices = Tuple[List[List[float]], List[List[float]], List[List[float]]]


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

    expected_size = len(locations)
    distances: List[List[Optional[float]]] = [
        [None] * expected_size for _ in range(expected_size)
    ]
    durations: List[List[Optional[float]]] = [
        [None] * expected_size for _ in range(expected_size)
    ]
    traffic_delays: List[List[Optional[float]]] = [
        [None] * expected_size for _ in range(expected_size)
    ]
    destination_chunk_size = min(expected_size, TOMTOM_SYNC_MATRIX_MAX_CELLS)
    origin_chunk_size = max(
        1, TOMTOM_SYNC_MATRIX_MAX_CELLS // destination_chunk_size
    )

    try:
        for origin_start in range(0, expected_size, origin_chunk_size):
            origin_end = min(origin_start + origin_chunk_size, expected_size)
            for destination_start in range(
                0, expected_size, destination_chunk_size
            ):
                destination_end = min(
                    destination_start + destination_chunk_size, expected_size
                )
                origins = locations[origin_start:origin_end]
                destinations = locations[destination_start:destination_end]
                request_body = {
                    "origins": [
                        {"point": {"latitude": latitude, "longitude": longitude}}
                        for latitude, longitude in origins
                    ],
                    "destinations": [
                        {"point": {"latitude": latitude, "longitude": longitude}}
                        for latitude, longitude in destinations
                    ],
                }
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
                except requests.Timeout as error:
                    raise MatrixRoutingUnavailableError(
                        "TomTom matrix request timed out"
                    ) from error
                except requests.HTTPError as error:
                    raise MatrixRoutingUnavailableError(
                        f"TomTom matrix request returned HTTP {response.status_code}"
                    ) from error
                except requests.RequestException as error:
                    raise MatrixRoutingUnavailableError(
                        "TomTom matrix request failed"
                    ) from error
                except ValueError as error:
                    raise MatrixRoutingUnavailableError(
                        "TomTom returned invalid JSON"
                    ) from error
                if not isinstance(payload, dict):
                    raise ValueError("TomTom returned an invalid response")

                if "matrix" in payload:
                    matrix = payload["matrix"]
                    if (
                        len(matrix) != len(origins)
                        or any(len(row) != len(destinations) for row in matrix)
                    ):
                        raise ValueError("TomTom returned an incomplete routing matrix")
                    matrix_entries = []
                    for local_origin, row in enumerate(matrix):
                        for local_destination, cell in enumerate(row):
                            if int(cell.get("statusCode", 0)) != 200:
                                raise ValueError(
                                    "TomTom returned an unsuccessful matrix cell"
                                )
                            matrix_entries.append(
                                (
                                    local_origin,
                                    local_destination,
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

                for local_origin, local_destination, summary in matrix_entries:
                    if not (0 <= local_origin < len(origins)):
                        raise ValueError("TomTom returned an invalid origin index")
                    if not (0 <= local_destination < len(destinations)):
                        raise ValueError("TomTom returned an invalid destination index")
                    distance_m = float(summary["lengthInMeters"])
                    duration_s = float(summary["travelTimeInSeconds"])
                    traffic_delay_s = float(summary.get("trafficDelayInSeconds", 0.0))
                    if (
                        not math.isfinite(distance_m)
                        or distance_m < 0
                        or not math.isfinite(duration_s)
                        or duration_s < 0
                        or not math.isfinite(traffic_delay_s)
                        or traffic_delay_s < 0
                    ):
                        raise ValueError(
                            "TomTom returned invalid distance or duration values"
                        )
                    origin_index = origin_start + local_origin
                    destination_index = destination_start + local_destination
                    distances[origin_index][destination_index] = distance_m
                    durations[origin_index][destination_index] = duration_s
                    traffic_delays[origin_index][destination_index] = traffic_delay_s

        if any(value is None for row in distances for value in row) or any(
            value is None for row in durations for value in row
        ) or any(value is None for row in traffic_delays for value in row):
            raise ValueError("TomTom returned an incomplete routing matrix")

        return (
            [[float(value) for value in row] for row in distances],
            [[float(value) for value in row] for row in durations],
            [[float(value) for value in row] for row in traffic_delays],
        )
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise MatrixRoutingUnavailableError(
            "TomTom matrix request failed or returned an invalid matrix"
        ) from error


def _fallback_matrices(
    locations: Sequence[Tuple[float, float]],
    travel_mode: str = "driving",
) -> Tuple[List[List[float]], List[List[float]], List[List[float]]]:
    costing = VALHALLA_COSTING[travel_mode]
    coordinates = ";".join(
        f"{longitude},{latitude}" for latitude, longitude in locations
    )
    try:
        if travel_mode == "driving":
            response = requests.get(
                f"{OSRM_TABLE_URL}/{coordinates}",
                params={"annotations": "distance,duration"},
                headers={"User-Agent": "PandalRouter/1.0"},
                timeout=OSRM_TABLE_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            distances = payload["distances"]
            durations = payload["durations"]
            expected_size = len(locations)
            if (
                payload.get("code") != "Ok"
                or len(distances) != expected_size
                or len(durations) != expected_size
                or any(len(row) != expected_size for row in distances)
                or any(len(row) != expected_size for row in durations)
            ):
                raise ValueError("OSRM returned an incomplete routing table")
            road_distances = [[float(value) for value in row] for row in distances]
            road_durations = [[float(value) for value in row] for row in durations]
        else:
            response = requests.post(
                f"{VALHALLA_URL}/sources_to_targets",
                json={
                    "sources": [{"lat": lat, "lon": lon} for lat, lon in locations],
                    "targets": [{"lat": lat, "lon": lon} for lat, lon in locations],
                    "costing": costing,
                    "units": "kilometers",
                },
                headers={"User-Agent": "PandalRouter/1.0"},
                timeout=VALHALLA_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            matrix = payload["sources_to_targets"]
            expected_size = len(locations)
            if (
                len(matrix) != expected_size
                or any(len(row) != expected_size for row in matrix)
            ):
                raise ValueError("Valhalla returned an incomplete routing matrix")
            road_distances = [
                [float(cell["distance"]) * 1000 for cell in row] for row in matrix
            ]
            road_durations = [
                [float(cell["time"]) for cell in row] for row in matrix
            ]
        if any(
            not math.isfinite(value) or value < 0
            for matrix in (road_distances, road_durations)
            for row in matrix
            for value in row
        ):
            raise ValueError("Routing provider returned invalid distance or duration values")
        return road_distances, road_durations, [
            [0.0 for _ in row] for row in road_distances
        ]
    except (requests.RequestException, KeyError, TypeError, ValueError) as error:
        logger.warning(
            "%s routing matrix unavailable; using distance-based estimates: %s",
            "OSRM" if travel_mode == "driving" else "Valhalla",
            error,
        )

    distances = [
        [
            _haversine_distance(origin, destination) * 1000 * (1.2 if travel_mode != "walking" else 1.15)
            for destination in locations
        ]
        for origin in locations
    ]
    durations = [
        [
            distance / (FALLBACK_SPEEDS_KMH[travel_mode] * 1000 / 3600)
            for distance in row
        ]
        for row in distances
    ]
    traffic_delays = [[0.0 for _ in row] for row in distances]
    return distances, durations, traffic_delays


def get_route_matrices_by_preference(
    locations: Sequence[Tuple[float, float]],
    travel_mode: str,
) -> Tuple[RouteMatrices, RouteMatrices, bool]:
    if travel_mode == "driving" and TOMTOM_API_KEY:
        try:
            traffic_aware_matrices = _get_tomtom_matrix(
                locations, route_type="fastest"
            )
            return traffic_aware_matrices, traffic_aware_matrices, True
        except MatrixRoutingUnavailableError as error:
            logger.warning(
                "TomTom traffic-aware matrix unavailable; using estimated driving costs: %s",
                error,
            )
    fallback = _fallback_matrices(locations, travel_mode)
    return fallback, fallback, False


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
    travel_mode: str = "driving",
) -> Tuple[List[List[List[float]]], List[List[Dict[str, Any]]]]:
    """Fetch mode-specific geometry and maneuvers, with a direct-route fallback."""
    fallback = [
        [[origin[0], origin[1]], [destination[0], destination[1]]]
        for origin, destination in zip(locations, locations[1:])
    ]
    if len(locations) < 2:
        return [], []
    if travel_mode == "transit":
        geometries, _ = get_road_leg_details(locations, "walking")
        directions = []
        for index, (destination, geometry) in enumerate(
            zip(locations[1:], geometries)
        ):
            distance_km = sum(
                _haversine_distance(
                    (point_a[0], point_a[1]), (point_b[0], point_b[1])
                )
                for point_a, point_b in zip(geometry, geometry[1:])
            )
            directions.append(
                [
                    {
                        "instruction": (
                            f"Transit estimate to stop {index + 1}; "
                            "check Google Maps for live routes and schedules"
                        ),
                        "distance_km": round(distance_km, 2),
                        "duration_min": math.ceil(
                            distance_km / FALLBACK_SPEEDS_KMH["transit"] * 60 + 10
                        ),
                        "location": {
                            "lat": destination[0],
                            "lng": destination[1],
                        },
                    }
                ]
            )
        return geometries, directions

    try:
        if travel_mode != "driving":
            response = requests.post(
                f"{VALHALLA_URL}/route",
                json={
                    "locations": [
                        {"lat": latitude, "lon": longitude}
                        for latitude, longitude in locations
                    ],
                    "costing": VALHALLA_COSTING[travel_mode],
                    "units": "kilometers",
                    "directions_options": {"units": "kilometers"},
                },
                headers={"User-Agent": "PandalRouter/1.0"},
                timeout=VALHALLA_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            route_legs = payload["trip"]["legs"]
            if len(route_legs) != len(fallback):
                raise ValueError("Valhalla returned an unexpected number of route legs")

            geometries = []
            directions = []
            for leg in route_legs:
                points = _decode_polyline6(leg["shape"])
                leg_directions = [
                    {
                        "instruction": str(step["instruction"]),
                        "distance_km": round(float(step.get("length", 0.0)), 2),
                        "duration_min": math.ceil(float(step.get("time", 0.0)) / 60),
                        "location": {
                            "lat": points[min(int(step.get("end_shape_index", 0)), len(points) - 1)][0],
                            "lng": points[min(int(step.get("end_shape_index", 0)), len(points) - 1)][1],
                        },
                    }
                    for step in leg.get("maneuvers", [])
                ]
                if len(points) < 2 or not leg_directions:
                    raise ValueError("Valhalla returned incomplete route details")
                geometries.append(points)
                directions.append(leg_directions)
            return geometries, directions

        coordinates = ";".join(
            f"{longitude},{latitude}" for latitude, longitude in locations
        )
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
                        "duration_min": math.ceil(float(step.get("duration", 0.0)) / 60),
                        "location": {"lat": float(latitude), "lng": float(longitude)},
                    }
                )
            geometries.append(points if len(points) >= 2 else direct_geometry)
            if not leg_directions:
                leg_directions.append(
                    {
                        "instruction": "Continue along the planned route",
                        "distance_km": round(float(leg.get("distance", 0.0)) / 1000, 2),
                        "duration_min": math.ceil(float(leg.get("duration", 0.0)) / 60),
                        "location": {"lat": locations[len(directions) + 1][0], "lng": locations[len(directions) + 1][1]},
                    }
                )
            directions.append(leg_directions)
        return geometries, directions
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError) as error:
        logger.warning(
            "%s route geometry unavailable; using direct segments: %s",
            "Valhalla" if travel_mode != "driving" else "OSRM",
            error,
        )
        directions = []
        for index, (origin, destination) in enumerate(zip(locations, locations[1:])):
            distance_km = _haversine_distance(origin, destination)
            if travel_mode != "driving":
                distance_km *= 1.2 if travel_mode != "walking" else 1.15
            directions.append(
                [
                    {
                        "instruction": (
                            f"Continue toward stop {index + 1}"
                            if travel_mode == "transit"
                            else "Continue along the planned route"
                        ),
                        "distance_km": round(distance_km, 2),
                        "duration_min": math.ceil(
                            distance_km / FALLBACK_SPEEDS_KMH[travel_mode] * 60
                            + (10 if travel_mode == "transit" else 0)
                        ),
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


def _decode_polyline6(encoded: str) -> List[List[float]]:
    coordinates = []
    latitude = longitude = 0
    index = 0
    while index < len(encoded):
        deltas = []
        for _ in range(2):
            result = shift = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        latitude += deltas[0]
        longitude += deltas[1]
        coordinates.append([latitude / 1_000_000, longitude / 1_000_000])
    return coordinates


def _traffic_level(travel_time_s: float, traffic_delay_s: float, is_live: bool) -> str:
    if not is_live:
        return "unavailable"
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
    travel_mode: str = "driving",
    matrices: Optional[RouteMatrices] = None,
    live_traffic: Optional[bool] = None,
) -> Dict[str, Any]:
    """Order stops using a nearest-neighbor heuristic over mode-specific costs."""
    if preference not in {"fastest", "shortest"}:
        raise ValueError("preference must be 'fastest' or 'shortest'")
    if travel_mode not in VALHALLA_COSTING:
        raise ValueError("travel_mode must be one of the supported travel modes")
    target_pandals = pandals[:max_pandals] if max_pandals is not None else pandals
    if not target_pandals:
        return {
            "total_distance_km": 0.0,
            "total_time_mins": 0.0,
            "average_speed_kmh": 0.0,
            "pandal_sequence": [],
            "traffic_source": "estimated",
            "preference": preference,
            "travel_mode": travel_mode,
        }

    locations = [start_loc, *(_coordinates(pandal) for pandal in target_pandals)]
    is_live_traffic = (
        bool(TOMTOM_API_KEY) and travel_mode == "driving"
        if live_traffic is None
        else live_traffic
    )
    if matrices is not None:
        distance_matrix, duration_matrix, traffic_delay_matrix = matrices
    elif is_live_traffic:
        try:
            distance_matrix, duration_matrix, traffic_delay_matrix = _get_tomtom_matrix(
                locations, route_type=preference
            )
        except MatrixRoutingUnavailableError:
            distance_matrix, duration_matrix, traffic_delay_matrix = _fallback_matrices(
                locations, travel_mode
            )
            is_live_traffic = False
    else:
        distance_matrix, duration_matrix, traffic_delay_matrix = _fallback_matrices(
            locations, travel_mode
        )
    if travel_mode == "transit":
        duration_matrix = [
            [
                (
                    distance / (FALLBACK_SPEEDS_KMH["transit"] * 1000 / 3600)
                    + (600 if origin != destination else 0)
                    if origin != destination
                    else 0
                )
                for destination, distance in enumerate(distance_row)
            ]
            for origin, distance_row in enumerate(distance_matrix)
        ]

    unvisited = set(range(1, len(locations)))
    current_index = 0
    total_distance_m = 0.0
    total_duration_mins = 0
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
        total_duration_s += duration_s * traffic_multiplier
        duration_min = math.ceil(duration_s / 60 * traffic_multiplier)
        total_duration_mins += duration_min
        sequence.append(
            {
                "step_number": len(sequence) + 1,
                "pandal_id": pandal["id"],
                "name": pandal["name"],
                "latitude": pandal["latitude"],
                "longitude": pandal["longitude"],
                "distance_from_prev_km": round(distance_m / 1000, 2),
                "estimated_time_mins": duration_min,
                "traffic_level": _traffic_level(
                    duration_s, traffic_delay_s, is_live_traffic
                ),
            }
        )
        current_index = next_index
        unvisited.remove(next_index)

    return {
        "total_distance_km": round(total_distance_m / 1000, 2),
        "total_time_mins": total_duration_mins,
        "average_speed_kmh": (
            total_distance_m / total_duration_s * 3.6 if total_duration_s > 0 else 0.0
        ),
        "pandal_sequence": sequence,
        "traffic_source": "live" if is_live_traffic else "estimated",
        "preference": preference,
        "travel_mode": travel_mode,
    }