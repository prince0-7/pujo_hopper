from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Coordinates(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class Pandal(BaseModel):
    id: int
    name: str
    zone: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    description: Optional[str] = None


class RouteRequest(BaseModel):
    user_location: Coordinates
    zone: str
    traffic_multiplier: float = Field(1.0, gt=0)
    max_pandals: Optional[int] = Field(None, ge=1)


class RouteStep(BaseModel):
    step_number: int
    pandal_id: int
    name: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    distance_from_prev_km: float = Field(..., ge=0)
    estimated_time_mins: int = Field(..., ge=0)


class RouteResponse(BaseModel):
    total_distance_km: float = Field(..., ge=0)
    total_time_mins: int = Field(..., ge=0)
    pandal_sequence: List[RouteStep]


class ApiLatLng(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)


class ApiPandal(ApiLatLng):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    zone: str
    area: str
    theme: str
    image_url: str = Field(alias="imageUrl")
    image_attribution: Optional[str] = Field(None, alias="imageAttribution")
    image_license: Optional[str] = Field(None, alias="imageLicense")
    image_license_url: Optional[str] = Field(None, alias="imageLicenseUrl")
    image_source_url: Optional[str] = Field(None, alias="imageSourceUrl")
    crowd_level: str = Field(alias="crowdLevel")


class ApiRouteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    origin: ApiLatLng
    pandal_ids: List[str] = Field(alias="pandalIds")
    algorithm: Optional[str] = None
    preference: Literal["fastest", "shortest"] = "fastest"
    travel_mode: Literal[
        "walking", "driving", "cycling", "motorcycle", "transit"
    ] = Field("driving", alias="travelMode")


class ApiDirectionStep(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    instruction: str
    distance_km: float = Field(alias="distanceKm", ge=0)
    duration_min: int = Field(alias="durationMin", ge=0)
    location: ApiLatLng


class ApiRouteLeg(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_location: ApiLatLng = Field(alias="from")
    to: ApiLatLng
    distance_km: float = Field(alias="distanceKm", ge=0)
    duration_min: int = Field(alias="durationMin", ge=0)
    traffic_level: str = Field(alias="trafficLevel")
    geometry: List[List[float]]
    steps: List[ApiDirectionStep]


class ApiRouteOption(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_distance_km: float = Field(alias="totalDistanceKm", ge=0)
    total_duration_min: int = Field(alias="totalDurationMin", ge=0)
    average_speed_kmh: float = Field(alias="averageSpeedKmh", ge=0)


class ApiRoutePlan(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_distance_km: float = Field(alias="totalDistanceKm", ge=0)
    total_duration_min: int = Field(alias="totalDurationMin", ge=0)
    average_speed_kmh: float = Field(alias="averageSpeedKmh", ge=0)
    ordered_stops: List[ApiPandal] = Field(alias="orderedStops")
    legs: List[ApiRouteLeg]
    traffic_source: str = Field(alias="trafficSource")
    preference: Literal["fastest", "shortest"]
    travel_mode: Literal[
        "walking", "driving", "cycling", "motorcycle", "transit"
    ] = Field(alias="travelMode")
    route_options: dict[Literal["fastest", "shortest"], ApiRouteOption] = Field(
        alias="routeOptions"
    )