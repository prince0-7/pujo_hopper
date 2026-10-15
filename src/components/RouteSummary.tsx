import { Clock3, Map, Navigation2, RefreshCw, Route, X } from 'lucide-react'
import type { RoutePlan, RoutePreference } from '../types'
import { TrafficLegend } from './TrafficLegend'

interface RouteSummaryProps {
  routePlan: RoutePlan
  onReoptimize: () => void
  onPreferenceChange: (preference: RoutePreference) => void
  onDirections: () => void
  onClose: () => void
  busy: boolean
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours > 0 ? `${hours} hr ${remainder} min` : `${minutes} min`
}

export function RouteSummary({ routePlan, onReoptimize, onPreferenceChange, onDirections, onClose, busy }: RouteSummaryProps) {
  return (
    <section className="route-summary" aria-label="Route summary">
      <header className="route-summary-head">
        <div className="route-summary-title"><div className="route-icon"><Route size={17} /></div><div><p className="eyebrow">Your Pujo trail</p><h2>Route planned</h2></div><span className={`traffic-source ${routePlan.trafficSource}`}>{routePlan.trafficSource === 'live' ? 'Live traffic' : 'Estimated traffic'}</span></div>
        <button className="icon-button" aria-label="Hide route summary" onClick={onClose}><X size={17} /></button>
      </header>
      <div className="route-totals">
        <div><Navigation2 size={15} /><strong>{routePlan.totalDistanceKm.toFixed(1)} <small>km</small></strong><span>Total distance</span></div>
        <div><Clock3 size={15} /><strong>{formatDuration(routePlan.totalDurationMin)}</strong><span>Estimated travel</span></div>
      </div>
      <div className="route-options-row">
        <div className="route-preference" role="group" aria-label="Route preference">
          <button type="button" aria-pressed={routePlan.preference === 'fastest'} onClick={() => onPreferenceChange('fastest')} disabled={busy}>Fastest</button>
          <button type="button" aria-pressed={routePlan.preference === 'shortest'} onClick={() => onPreferenceChange('shortest')} disabled={busy}>Shortest</button>
        </div>
        <span className="preference-caption">{routePlan.preference === 'shortest' ? 'Least distance' : 'Traffic-aware ETA'}</span>
      </div>
      <TrafficLegend />
      <div className="leg-list" aria-label="Travel time by leg">
        {routePlan.legs.map((leg, index) => (
          <div className="leg-row" key={`${index}-${leg.trafficLevel}`}>
            <span className={`leg-dot traffic-${leg.trafficLevel}`} />
            <span className="leg-name">{index === 0 ? 'Your location' : routePlan.orderedStops[index - 1]?.name}<span className="leg-arrow"> → </span>{routePlan.orderedStops[index]?.name}</span>
            <span className="leg-duration">{formatDuration(leg.durationMin)}</span>
          </div>
        ))}
      </div>
      <button className="directions-entry-button" type="button" onClick={onDirections}><Map size={15} /> Directions <span>Turn-by-turn</span></button>
      <button className="reoptimize-button" type="button" onClick={onReoptimize} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} />{busy ? (routePlan.trafficSource === 'live' ? 'Checking traffic…' : 'Re-planning…') : (routePlan.trafficSource === 'live' ? 'Re-optimize with live traffic' : 'Re-plan route')}</button>
      <p className="route-disclaimer">{routePlan.trafficSource === 'live' ? 'Live traffic-aware travel times; traffic can change en route.' : 'Estimated travel times; configure TOMTOM_API_KEY for live traffic.'}</p>
    </section>
  )
}
