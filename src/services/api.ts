import mockPandals from '../mocks/pandals.json'
import directoryPandals from '../mocks/directoryPandals.json'
import type { LatLng, Pandal, RouteLeg, RoutePlan, RoutePreference, TrafficLevel, Zone } from '../types'
import { haversine } from '../utils/geo'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api').replace(/\/+$/, '')
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const MOCK_LATENCY_MS = 420
const trafficLevels: TrafficLevel[] = ['low', 'moderate', 'heavy']
const allPandals = [...(mockPandals as Pandal[]), ...(directoryPandals as Pandal[])]

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

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
}

export async function planRoute({ origin, pandalIds, preference = 'fastest' }: PlanRouteRequest): Promise<RoutePlan> {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/routes/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, pandalIds, preference }),
    })
    if (!response.ok) await throwApiError(response, 'Could not plan this route.')
    return response.json() as Promise<RoutePlan>
  }

  await wait(MOCK_LATENCY_MS + 280)
  const selected = allPandals.filter((pandal) => pandalIds.includes(pandal.id))
  const remaining = [...selected]
  const orderedStops: Pandal[] = []
  let cursor = origin

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((pandal, index) => {
      const distance = haversine(cursor, pandal)
      const crowdPenalty = pandal.crowdLevel === 'high' ? 1.28 : pandal.crowdLevel === 'medium' ? 1.12 : 1
      const routeCost = preference === 'shortest' ? distance : distance * crowdPenalty
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
    const distanceKm = haversine(from, to) * (1.12 + Math.random() * 0.2)
    const trafficLevel = trafficLevels[Math.floor(Math.random() * trafficLevels.length)]
    const trafficMultiplier = trafficLevel === 'heavy' ? 3.3 : trafficLevel === 'moderate' ? 2.4 : 1.8
    const durationMin = Math.round((distanceKm / 18) * 60 * trafficMultiplier)
    const bend = (Math.random() - 0.5) * 0.025

    return {
      from,
      to,
      distanceKm,
      durationMin,
      trafficLevel,
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

  return {
    totalDistanceKm: legs.reduce((total, leg) => total + leg.distanceKm, 0),
    totalDurationMin: legs.reduce((total, leg) => total + leg.durationMin, 0),
    trafficSource: 'estimated',
    preference,
    orderedStops,
    legs,
  }
}
