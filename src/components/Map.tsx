import { divIcon } from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import type { LatLng, Pandal, RoutePlan, ZoneFilter } from '../types'
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

const trafficColors = { low: '#3b936d', moderate: '#d79a28', heavy: '#c54638' }

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
      <Marker position={[userLocation.lat, userLocation.lng]} icon={currentLocationIcon()} keyboard title="Your location" />
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
        <Polyline
          key={`${index}-${leg.trafficLevel}`}
          positions={leg.geometry}
          pathOptions={{ color: trafficColors[leg.trafficLevel], weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }}
        />
      ))}
      {routePlan?.orderedStops.map((stop, index) => (
        <Marker key={`stop-${stop.id}`} position={[stop.lat, stop.lng]} icon={stopIcon(index + 1)} zIndexOffset={1000} title={`Stop ${index + 1}: ${stop.name}`} />
      ))}
    </MapContainer>
  )
}
