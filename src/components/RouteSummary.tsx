import { Clock3, Map, Navigation2, RefreshCw, Route, X } from 'lucide-react'
import type { RoutePlan, RoutePreference, TravelMode } from '../types'
import { formatDuration } from '../utils/formatDuration'
import { TrafficLegend } from './TrafficLegend'

interface RouteSummaryProps {
  routePlan: RoutePlan
  onReoptimize: () => void
  onPreferenceChange: (preference: RoutePreference) => void
  onTravelModeChange: (mode: TravelMode) => void
  onDirections: () => void
  onClose: () => void
  busy: boolean
  routeNeedsUpdate: boolean
}

const travelModeLabels: Record<TravelMode, string> = {
  walking: 'Walking',
  driving: 'Driving',
  cycling: 'Cycling',
  motorcycle: 'Motorcycle / scooter',
  transit: 'Public transit',
}

export function RouteSummary({ routePlan, onReoptimize, onPreferenceChange, onTravelModeChange, onDirections, onClose, busy, routeNeedsUpdate }: RouteSummaryProps) {
  return (
    <section className="route-summary" role="dialog" aria-label="Route summary">
      <header className="route-summary-head">
        <div className="route-summary-title"><div className="route-icon"><Route size={17} /></div><div><p className="eyebrow">Your Pujo trail · {travelModeLabels[routePlan.travelMode]}</p><h2>Route comparison</h2></div><span className={`traffic-source ${routePlan.trafficSource}`}>{routePlan.trafficSource === 'live' ? 'TomTom traffic' : 'ETA estimate'}</span></div>
        <button className="icon-button" aria-label="Hide route summary" onClick={onClose}><X size={17} /></button>
      </header>
      {routeNeedsUpdate && <p className="route-update-notice" role="status">New pandals are queued. The map and traffic below show the previous route until you update it.</p>}
      <div className="route-totals">
        <div><Navigation2 size={15} /><strong>{routePlan.totalDistanceKm.toFixed(1)} <small>km</small></strong><span>Total distance</span></div>
        <div><Clock3 size={15} /><strong>{formatDuration(routePlan.totalDurationMin)}</strong><span>Estimated travel</span></div>
      </div>
      <div className="route-options-row">
        <div className="route-comparison" role="group" aria-label="Compare fastest and shortest routes">
          {(['fastest', 'shortest'] as const).map((preference) => {
            const option = routePlan.routeOptions[preference]
            return (
              <button className={`route-comparison-option ${routePlan.preference === preference ? 'active' : ''}`} key={preference} type="button" aria-pressed={routePlan.preference === preference} onClick={() => onPreferenceChange(preference)} disabled={busy}>
                <strong>{preference === 'fastest' ? 'Fastest' : 'Shortest'}</strong>
                <span>{formatDuration(option.totalDurationMin)}</span>
                <small>{option.totalDistanceKm.toFixed(1)} km</small>
              </button>
            )
          })}
        </div>
      </div>
      <label className="summary-mode-control">
        <span>Travel mode</span>
        <select value={routePlan.travelMode} onChange={(event) => onTravelModeChange(event.target.value as TravelMode)} disabled={busy}>
          {Object.entries(travelModeLabels).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
        </select>
      </label>
      <p className="speed-reference">Effective average (distance ÷ ETA): <strong>{routePlan.averageSpeedKmh.toFixed(1)} km/h</strong></p>
      <TrafficLegend trafficAvailable={routePlan.trafficSource === 'live'} />
      <div className="leg-list" aria-label="Travel time by leg">
        {routePlan.legs.map((leg, index) => (
          <div className="leg-row" key={`${index}-${leg.trafficLevel}`}>
            <span className={`leg-dot traffic-${leg.trafficLevel}`} aria-hidden="true" />
            <span className="leg-name">
              <span className="leg-route-pair">{index === 0 ? 'Your location' : routePlan.orderedStops[index - 1]?.name}<span className="leg-arrow"> → </span>{routePlan.orderedStops[index]?.name}</span>
              <small className={`leg-traffic traffic-${leg.trafficLevel}`}>{leg.trafficLevel === 'unavailable' ? 'live traffic unavailable' : `${leg.trafficLevel} traffic`}{routePlan.trafficSource === 'live' ? ' · live' : ''} · {leg.distanceKm.toFixed(1)} km</small>
            </span>
            <span className="leg-duration">{formatDuration(leg.durationMin)}</span>
          </div>
        ))}
      </div>
      <button className="directions-entry-button" type="button" onClick={onDirections}><Map size={15} /> Directions <span>Turn-by-turn</span></button>
      <button className="reoptimize-button" type="button" onClick={onReoptimize} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} />{busy ? 'Planning…' : routeNeedsUpdate ? 'Update route with queued pandals' : (routePlan.trafficSource === 'live' ? 'Re-optimize with live traffic' : 'Re-plan route')}</button>
      <p className="route-disclaimer">{routePlan.travelMode === 'transit' ? 'Transit times are rough estimates, not live schedules. Open Google Maps for real routes and departures.' : routePlan.trafficSource === 'live' ? 'Driving ETA includes traffic from TomTom. Live traffic changes; ETA uses the provider’s traffic-aware duration.' : `Live congestion data is unavailable. ${travelModeLabels[routePlan.travelMode]} ETA uses typical route durations, not current traffic.`}</p>
      <p className="route-map-hint">Tap a numbered stop or colored route segment for leg details.</p>
    </section>
  )
}
