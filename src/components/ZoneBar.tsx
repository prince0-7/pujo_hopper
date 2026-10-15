import { ArrowUpRight, MapPinned, Route, SlidersHorizontal } from 'lucide-react'
import type { ZoneFilter } from '../types'

const zones: ZoneFilter[] = ['All', 'North', 'South', 'Central', 'Salt Lake', 'Kalyani', 'Other areas']

interface ZoneBarProps {
  selectedZone: ZoneFilter
  radiusKm: number
  onZoneChange: (zone: ZoneFilter) => void
  onRadiusChange: (radius: number) => void
  onPlanRoute: () => void
  routeBusy: boolean
  stopCount: number
}

export function ZoneBar({ selectedZone, radiusKm, onZoneChange, onRadiusChange, onPlanRoute, routeBusy, stopCount }: ZoneBarProps) {
  return (
    <section className="zone-bar" aria-label="Pandal filters and route planning">
      <div className="filter-row">
        <div className="filter-label"><SlidersHorizontal size={14} aria-hidden="true" /><span>Explore</span></div>
        <label className="radius-control">
          <MapPinned size={14} aria-hidden="true" />
          <span>Within <strong>{radiusKm} km</strong></span>
          <input aria-label={`Search radius: ${radiusKm} kilometres`} type="range" min="1" max="80" value={radiusKm} onChange={(event) => onRadiusChange(Number(event.target.value))} />
        </label>
      </div>
      <div className="zone-row" role="group" aria-label="Choose a pandal zone">
        {zones.map((zone) => (
          <button key={zone} type="button" className={`zone-chip ${selectedZone === zone ? 'active' : ''}`} aria-pressed={selectedZone === zone} onClick={() => onZoneChange(zone)}>
            {zone}
          </button>
        ))}
        <span className="zone-divider" aria-hidden="true" />
        <button type="button" className="plan-button" onClick={onPlanRoute} disabled={routeBusy || stopCount === 0}>
          <Route size={16} aria-hidden="true" />
          <span>{routeBusy ? 'Planning…' : 'Plan route'}</span>
          {!routeBusy && <ArrowUpRight size={14} aria-hidden="true" />}
        </button>
      </div>
    </section>
  )
}
