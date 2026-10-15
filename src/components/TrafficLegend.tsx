import type { TrafficLevel } from '../types'

const traffic: { level: TrafficLevel; label: string }[] = [
  { level: 'low', label: 'Light' },
  { level: 'moderate', label: 'Moderate' },
  { level: 'heavy', label: 'Heavy' },
]

export function TrafficLegend() {
  return (
    <div className="traffic-legend" aria-label="Route traffic legend">
      <span className="legend-title">Traffic</span>
      {traffic.map(({ level, label }) => <span className={`legend-item traffic-${level}`} key={level}><i aria-hidden="true" />{label}</span>)}
    </div>
  )
}
