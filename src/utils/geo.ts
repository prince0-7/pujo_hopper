import type { LatLng } from '../types'

const EARTH_RADIUS_KM = 6371

export function haversine(a: LatLng, b: LatLng): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(b.lat - a.lat)
  const longitudeDelta = toRadians(b.lng - a.lng)
  const haversineValue =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(longitudeDelta / 2) ** 2

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
}
