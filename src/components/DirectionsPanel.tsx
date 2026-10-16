import { ArrowLeft, ArrowUpRight, Clock3, ExternalLink, MapPin, Navigation2, Route } from 'lucide-react'
import type { RoutePlan } from '../types'
import { formatDuration } from '../utils/formatDuration'

interface DirectionsPanelProps {
  routePlan: RoutePlan
  onBack: () => void
}

function getGoogleMapsUrl(routePlan: RoutePlan) {
  const firstLeg = routePlan.legs[0]
  const lastLeg = routePlan.legs.at(-1)
  if (!firstLeg || !lastLeg) return null

  const travelmode = {
    walking: 'walking',
    driving: 'driving',
    cycling: 'bicycling',
    motorcycle: 'driving',
    transit: 'transit',
  }[routePlan.travelMode]
  const params = new URLSearchParams({
    api: '1',
    origin: `${firstLeg.from.lat},${firstLeg.from.lng}`,
    destination: `${lastLeg.to.lat},${lastLeg.to.lng}`,
    travelmode,
  })
  const waypoints = routePlan.orderedStops.slice(0, -1).map((stop) => `${stop.lat},${stop.lng}`)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function DirectionsPanel({ routePlan, onBack }: DirectionsPanelProps) {
  const mapsUrl = getGoogleMapsUrl(routePlan)

  return (
    <section className="directions-panel" aria-label="Turn-by-turn directions">
      <header className="directions-header">
        <button className="icon-button directions-back" type="button" onClick={onBack} aria-label="Back to route summary"><ArrowLeft size={18} /></button>
        <div className="directions-heading"><p className="eyebrow">{routePlan.preference === 'shortest' ? 'Shortest distance' : 'Fastest route'} · {routePlan.travelMode}</p><h2>Directions</h2></div>
        <span className={`traffic-source ${routePlan.trafficSource}`}>{routePlan.trafficSource === 'live' ? 'TomTom traffic' : 'ETA estimate'}</span>
      </header>

      <div className="directions-totals">
        <span><Navigation2 size={14} />{routePlan.totalDistanceKm.toFixed(1)} km</span>
        <span><Clock3 size={14} />{formatDuration(routePlan.totalDurationMin)}</span>
        <span><Route size={14} />{routePlan.orderedStops.length} stops</span>
      </div>

      {mapsUrl && (
        <a className="google-maps-button" href={mapsUrl} target="_blank" rel="noreferrer">
          <MapPin size={16} /> Open in Google Maps <ExternalLink size={14} />
        </a>
      )}

      <ol className="directions-legs">
        {routePlan.legs.map((leg, legIndex) => {
          const fromName = legIndex === 0 ? 'Your location' : routePlan.orderedStops[legIndex - 1]?.name ?? 'Previous stop'
          const toName = routePlan.orderedStops[legIndex]?.name ?? 'Destination'
          return (
            <li className="directions-leg" key={`${legIndex}-${toName}`}>
              <div className="directions-leg-heading">
                <span className="directions-leg-number">{legIndex + 1}</span>
                <div><strong>{fromName}</strong><span className="directions-to"><ArrowUpRight size={12} /> {toName}</span></div>
                <span className={`directions-traffic traffic-${leg.trafficLevel}`} aria-hidden="true" />
                <span className={`directions-traffic-label traffic-${leg.trafficLevel}`}>{leg.trafficLevel === 'unavailable' ? 'traffic n/a' : leg.trafficLevel}{routePlan.trafficSource === 'live' ? ' · live' : ''}</span>
              </div>
              <ol className="maneuver-list">
                {leg.steps.map((step, stepIndex) => (
                  <li className="maneuver-row" key={`${stepIndex}-${step.instruction}`}>
                    <span className="maneuver-marker" aria-hidden="true" />
                    <div className="maneuver-copy"><span>{step.instruction}</span><small>{step.distanceKm.toFixed(1)} km · {formatDuration(step.durationMin)}</small></div>
                  </li>
                ))}
              </ol>
            </li>
          )
        })}
      </ol>
      <p className="directions-disclaimer">{routePlan.travelMode === 'transit' ? 'Transit estimates are approximate. Open Google Maps above for live routes, transfers, and departure times.' : 'Google Maps may recalculate based on current road conditions.'}</p>
    </section>
  )
}
