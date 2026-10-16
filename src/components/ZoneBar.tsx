import { ArrowUpRight, MapPinned, Route, SlidersHorizontal } from 'lucide-react'
import type { TravelMode, ZoneFilter } from '../types'

const zones: ZoneFilter[] = ['All', 'North', 'South', 'Central', 'Salt Lake', 'Kalyani', 'Other areas']
const fallbackSpeedsKmh: Record<TravelMode, number> = {
  walking: 4.8,
  driving: 20,
  cycling: 15,
  motorcycle: 25,
  transit: 18,
}

interface ZoneBarProps {
  selectedZone: ZoneFilter
  radiusKm: number
  travelMode: TravelMode
  onTravelModeChange: (mode: TravelMode) => void
  onZoneChange: (zone: ZoneFilter) => void
  onRadiusChange: (radius: number) => void
  onPlanRoute: () => void
  routeBusy: boolean
  stopCount: number
}

export function ZoneBar({ selectedZone, radiusKm, travelMode, onTravelModeChange, onZoneChange, onRadiusChange, onPlanRoute, routeBusy, stopCount }: ZoneBarProps) {
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
      </div>
      <div className="zone-controls">
        <label className="travel-mode-control">
          <span>Travel</span>
          <select className="travel-mode-select" value={travelMode} onChange={(event) => onTravelModeChange(event.target.value as TravelMode)} disabled={routeBusy}>
            <option value="walking">Walking</option>
            <option value="driving">Driving</option>
            <option value="cycling">Cycling</option>
            <option value="motorcycle">Motorcycle / scooter</option>
            <option value="transit">Public transit</option>
          </select>
          <small>Fallback {fallbackSpeedsKmh[travelMode]} km/h</small>
        </label>
        <button type="button" className="plan-button" onClick={() => onPlanRoute()} disabled={routeBusy || stopCount === 0}>
          <Route size={16} aria-hidden="true" />
          <span>{routeBusy ? 'Planning…' : 'Plan route'}</span>
          {!routeBusy && <ArrowUpRight size={14} aria-hidden="true" />}
        </button>
      </div>
    </section>
  )
}
