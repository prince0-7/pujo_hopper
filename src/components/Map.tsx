import { divIcon } from 'leaflet'
import { Fragment, useEffect } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import type { LatLng, Pandal, RoutePlan, ZoneFilter } from '../types'
import { formatDuration } from '../utils/formatDuration'
import { PandalMarker } from './PandalMarker'

interface MapProps {
  userLocation: LatLng
  selectedZone: ZoneFilter
  pandals: Pandal[]
  routePlan: RoutePlan | null
  visitingIds: Set<string>
  onAdd: (pandal: Pandal) => void
  distanceFromUser: (pandal: Pandal) => number
}

const trafficColors = { low: '#00a870', moderate: '#facc15', heavy: '#ef3340' }
const trafficLabels = { low: 'Light traffic', moderate: 'Moderate traffic', heavy: 'Heavy traffic', unavailable: 'Live traffic unavailable' }

function currentLocationIcon() {
  return divIcon({
    className: 'current-location-wrap',
    html: '<span class="user-pulse"><span class="user-pulse-core"></span></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function stopIcon(number: number) {
  return divIcon({
    className: 'route-stop-wrap',
    html: `<span class="route-stop-number">${number}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function RouteViewport({ routePlan, userLocation, selectedZone, pandals }: { routePlan: RoutePlan | null; userLocation: LatLng; selectedZone: ZoneFilter; pandals: Pandal[] }) {
  const map = useMap()
  const pandalBounds = pandals.map((pandal) => `${pandal.lat},${pandal.lng}`).join(';')

  useEffect(() => {
    const recenter = () => map.setView([userLocation.lat, userLocation.lng], 13, { animate: true })
    window.addEventListener('pandal-recenter', recenter)
    return () => window.removeEventListener('pandal-recenter', recenter)
  }, [map, userLocation])

  useEffect(() => {
    if (routePlan && routePlan.legs.length > 0) {
      const points = routePlan.legs.flatMap((leg) => leg.geometry)
      map.fitBounds(points, { paddingTopLeft: [44, 70], paddingBottomRight: [44, 190], maxZoom: 14, animate: true, duration: 0.8 })
    } else if (selectedZone !== 'All' && pandalBounds) {
      const points = pandalBounds.split(';').map((point) => point.split(',').map(Number) as [number, number])
      map.fitBounds(points, { paddingTopLeft: [50, 125], paddingBottomRight: [50, 175], maxZoom: 14, animate: true, duration: 0.8 })
    }
  }, [map, routePlan, selectedZone, pandalBounds])

  return null
}

export function MapView({ userLocation, selectedZone, pandals, routePlan, visitingIds, onAdd, distanceFromUser }: MapProps) {
  return (
    <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={13} zoomControl={false} className="map-canvas" aria-label="Map of Durga Puja pandals in Kolkata">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RouteViewport routePlan={routePlan} userLocation={userLocation} selectedZone={selectedZone} pandals={pandals} />
      <Marker position={[userLocation.lat, userLocation.lng]} icon={currentLocationIcon()} keyboard title="Your location">
        {routePlan?.legs[0] && (
          <Popup>
            <article className="route-leg-popup">
              <p className="eyebrow">Route start</p>
              <h2>Your location → {routePlan.orderedStops[0]?.name ?? 'First stop'}</h2>
              <span className={`route-traffic-pill traffic-${routePlan.legs[0].trafficLevel}`}>
                {trafficLabels[routePlan.legs[0].trafficLevel]}{routePlan.trafficSource === 'live' && routePlan.legs[0].trafficLevel !== 'unavailable' ? ' · TomTom' : ''}
              </span>
              <p>{routePlan.legs[0].distanceKm.toFixed(1)} km · {formatDuration(routePlan.legs[0].durationMin)}</p>
            </article>
          </Popup>
        )}
      </Marker>
      {pandals.map((pandal) => (
        <PandalMarker
          key={pandal.id}
          pandal={pandal}
          distanceKm={distanceFromUser(pandal)}
          added={visitingIds.has(pandal.id)}
          onAdd={onAdd}
        />
      ))}
      {routePlan?.legs.map((leg, index) => (
        <Fragment key={`route-${index}`}>
          <Polyline
            key="outline"
            positions={leg.geometry}
            pathOptions={{ color: '#ff8c00', weight: 14, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
          />
          <Polyline
            key="route-halo"
            positions={leg.geometry}
            pathOptions={{ color: '#fffdf8', weight: 10, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
          />
          <Polyline
            key={`leg-${leg.trafficLevel}`}
            positions={leg.geometry}
            pathOptions={{ color: leg.trafficLevel === 'unavailable' ? '#ff8c00' : trafficColors[leg.trafficLevel], weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
          >
            <Popup>
              <article className="route-leg-popup">
                <p className="eyebrow">{routePlan?.preference === 'shortest' ? 'Shortest route' : 'Fastest route'} · {routePlan?.travelMode} · Leg {index + 1}</p>
                <h2>{index === 0 ? 'Your location' : routePlan?.orderedStops[index - 1]?.name ?? 'Previous stop'} → {routePlan?.orderedStops[index]?.name ?? 'Destination'}</h2>
                <span className={`route-traffic-pill traffic-${leg.trafficLevel}`}>
                  {trafficLabels[leg.trafficLevel]}{routePlan?.trafficSource === 'live' && leg.trafficLevel !== 'unavailable' ? ' · TomTom' : ''}
                </span>
                <p>{leg.distanceKm.toFixed(1)} km · {formatDuration(leg.durationMin)}</p>
              </article>
            </Popup>
          </Polyline>
        </Fragment>
      ))}
      {routePlan?.orderedStops.map((stop, index) => (
        <Marker key={`stop-${stop.id}`} position={[stop.lat, stop.lng]} icon={stopIcon(index + 1)} zIndexOffset={1000} title={`Stop ${index + 1}: ${stop.name}`}>
          {routePlan.legs[index] && (
            <Popup>
              <article className="route-leg-popup">
                <p className="eyebrow">Stop {index + 1}</p>
                <h2>{stop.name}</h2>
                <span className={`route-traffic-pill traffic-${routePlan.legs[index].trafficLevel}`}>
                  {trafficLabels[routePlan.legs[index].trafficLevel]}{routePlan.trafficSource === 'live' && routePlan.legs[index].trafficLevel !== 'unavailable' ? ' · TomTom' : ''}
                </span>
                <p>{routePlan.legs[index].distanceKm.toFixed(1)} km · {formatDuration(routePlan.legs[index].durationMin)} from previous stop</p>
              </article>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  )
}
