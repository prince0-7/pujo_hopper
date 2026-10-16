import type { TrafficLevel } from '../types'

const traffic: { level: TrafficLevel; label: string }[] = [
  { level: 'low', label: 'Light' },
  { level: 'moderate', label: 'Moderate' },
  { level: 'heavy', label: 'Heavy' },
]

export function TrafficLegend({ trafficAvailable }: { trafficAvailable: boolean }) {
  return (
    <div className="traffic-legend" aria-label="Route traffic legend">
      {trafficAvailable ? (
        <>
          <span className="legend-title">Route</span>
          <span className="legend-item planned-route"><i aria-hidden="true" />Planned</span>
          <span className="legend-title">TomTom traffic</span>
          {traffic.map(({ level, label }) => <span className={`legend-item traffic-${level}`} key={level}><i aria-hidden="true" />{label}</span>)}
        </>
      ) : (
        <>
          <span className="legend-title">Route</span>
          <span className="legend-item planned-route"><i aria-hidden="true" />Planned</span>
          <span className="traffic-unavailable-note">Live traffic unavailable; showing typical travel estimates.</span>
        </>
      )}
    </div>
  )
}
