export type Zone = 'North' | 'South' | 'Central' | 'Salt Lake' | 'Kalyani' | 'Other areas'
export type ZoneFilter = Zone | 'All'
export type CrowdLevel = 'low' | 'medium' | 'high'
export type TrafficLevel = 'low' | 'moderate' | 'heavy'
export type RoutePreference = 'fastest' | 'shortest'
export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'

export interface LatLng {
  lat: number
  lng: number
}

export interface Pandal extends LatLng {
  id: string
  name: string
  zone: Zone
  area: string
  theme: string
  imageUrl: string
  crowdLevel: CrowdLevel
}

export interface RouteLeg {
  from: LatLng
  to: LatLng
  distanceKm: number
  durationMin: number
  trafficLevel: TrafficLevel
  geometry: [number, number][]
  steps: RouteDirectionStep[]
}

export interface RouteDirectionStep {
  instruction: string
  distanceKm: number
  durationMin: number
  location: LatLng
}

export interface RoutePlan {
  totalDistanceKm: number
  totalDurationMin: number
  trafficSource: 'live' | 'estimated'
  preference: RoutePreference
  orderedStops: Pandal[]
  legs: RouteLeg[]
}
