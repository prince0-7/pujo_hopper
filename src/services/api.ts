import mockPandals from '../mocks/pandals.json'
import directoryPandals from '../mocks/directoryPandals.json'
import type { LatLng, Pandal, RouteLeg, RoutePlan, RoutePreference, TravelMode, Zone } from '../types'
import { haversine } from '../utils/geo'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api').replace(/\/+$/, '')
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const MOCK_LATENCY_MS = 420
const travelSpeedsKmh: Record<TravelMode, number> = {
  walking: 4.8,
  driving: 20,
  cycling: 15,
  motorcycle: 25,
  transit: 18,
}
const allPandals = [...(mockPandals as Pandal[]), ...(directoryPandals as Pandal[])]

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

function estimateLeg(from: LatLng, to: LatLng, travelMode: TravelMode) {
  const segmentKey = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}:${to.lat.toFixed(4)},${to.lng.toFixed(4)}`
  const seed = [...segmentKey].reduce((value, character) => value + character.charCodeAt(0), 0)
  const distanceKm = haversine(from, to) * (1.12 + (seed % 9) / 100)
  const durationMin = Math.ceil((distanceKm / travelSpeedsKmh[travelMode]) * 60 + (travelMode === 'transit' ? 10 : 0))
  return { distanceKm, durationMin, bend: ((seed % 51) - 25) / 1000 }
}

function buildMockPlan(origin: LatLng, pandalIds: string[], preference: RoutePreference, travelMode: TravelMode): RoutePlan {
  const selected = allPandals.filter((pandal) => pandalIds.includes(pandal.id))
  const remaining = [...selected]
  const orderedStops: Pandal[] = []
  let cursor = origin

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((pandal, index) => {
      const estimate = estimateLeg(cursor, pandal, travelMode)
      const routeCost = preference === 'shortest' ? estimate.distanceKm : estimate.durationMin
      if (routeCost < nearestDistance) {
        nearestDistance = routeCost
        nearestIndex = index
      }
    })
    const [next] = remaining.splice(nearestIndex, 1)
    if (next) {
      orderedStops.push(next)
      cursor = next
    }
  }

  const points: LatLng[] = [origin, ...orderedStops]
  const legs: RouteLeg[] = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]
    const { distanceKm, durationMin, bend } = estimateLeg(from, to, travelMode)

    return {
      from,
      to,
      distanceKm,
      durationMin,
      trafficLevel: 'unavailable',
      geometry: [
        [from.lat, from.lng],
        [(from.lat + to.lat) / 2 + bend, (from.lng + to.lng) / 2 - bend],
        [to.lat, to.lng],
      ],
      steps: [{
        instruction: `Continue toward ${orderedStops[index]?.name ?? 'your destination'}`,
        distanceKm,
        durationMin,
        location: to,
      }],
    }
  })
  const totalDistanceKm = legs.reduce((total, leg) => total + leg.distanceKm, 0)
  const totalDurationMin = legs.reduce((total, leg) => total + leg.durationMin, 0)

  return {
    totalDistanceKm,
    totalDurationMin,
    averageSpeedKmh: totalDurationMin ? totalDistanceKm / (totalDurationMin / 60) : 0,
    trafficSource: 'estimated',
    preference,
    travelMode,
    routeOptions: {
      fastest: { totalDistanceKm, totalDurationMin, averageSpeedKmh: totalDurationMin ? totalDistanceKm / (totalDurationMin / 60) : 0 },
      shortest: { totalDistanceKm, totalDurationMin, averageSpeedKmh: totalDurationMin ? totalDistanceKm / (totalDurationMin / 60) : 0 },
    },
    orderedStops,
    legs,
  }
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) message = payload.detail
  } catch {
    if (response.statusText) message = `${fallback} (${response.statusText})`
  }
  throw new Error(message)
}

export async function getPandals(zone?: Zone): Promise<Pandal[]> {
  if (!USE_MOCK) {
    const query = zone ? `?zone=${encodeURIComponent(zone)}` : ''
    const response = await fetch(`${API_BASE_URL}/pandals${query}`)
    if (!response.ok) await throwApiError(response, 'Could not load pandals.')
    return response.json() as Promise<Pandal[]>
  }

  await wait(MOCK_LATENCY_MS)
  return allPandals.filter((pandal) => !zone || pandal.zone === zone)
}

interface PlanRouteRequest {
  origin: LatLng
  pandalIds: string[]
  algorithm?: 'dijkstra' | 'astar'
  preference?: RoutePreference
  travelMode?: TravelMode
}

export async function planRoute({ origin, pandalIds, preference = 'fastest', travelMode = 'driving' }: PlanRouteRequest): Promise<RoutePlan> {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/routes/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, pandalIds, preference, travelMode }),
    })
    if (!response.ok) await throwApiError(response, 'Could not plan this route.')
    return response.json() as Promise<RoutePlan>
  }

  await wait(MOCK_LATENCY_MS + 280)
  const fastest = buildMockPlan(origin, pandalIds, 'fastest', travelMode)
  const shortest = buildMockPlan(origin, pandalIds, 'shortest', travelMode)
  const active = preference === 'fastest' ? fastest : shortest
  return {
    ...active,
    routeOptions: {
      fastest: {
        totalDistanceKm: fastest.totalDistanceKm,
        totalDurationMin: fastest.totalDurationMin,
        averageSpeedKmh: fastest.averageSpeedKmh,
      },
      shortest: {
        totalDistanceKm: shortest.totalDistanceKm,
        totalDurationMin: shortest.totalDurationMin,
        averageSpeedKmh: shortest.averageSpeedKmh,
      },
    },
  }
}
