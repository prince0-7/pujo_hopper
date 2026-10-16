import { useEffect, useState } from 'react'
import { Bell, ChevronDown, ListChecks, LocateFixed, MapPin, X } from 'lucide-react'
import { DirectionsPanel } from './components/DirectionsPanel'
import { MapView } from './components/Map'
import { PermissionModal } from './components/PermissionModal'
import { RouteSummary } from './components/RouteSummary'
import { VisitingDrawer } from './components/VisitingDrawer'
import { ZoneBar } from './components/ZoneBar'
import { useGeolocation } from './hooks/useGeolocation'
import { planRoute } from './services/api'
import { useAppStore } from './store/useAppStore'
import type { RoutePreference, TravelMode } from './types'
import { haversine } from './utils/geo'
import './App.css'

function App() {
  const app = useAppStore()
  const { requestLocation, setApproximateLocation } = useGeolocation()
  const [permissionOpen, setPermissionOpen] = useState(true)
  const [approximateBannerDismissed, setApproximateBannerDismissed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [routeBusy, setRouteBusy] = useState(false)
  const [routePreference, setRoutePreference] = useState<RoutePreference>('fastest')
  const [travelMode, setTravelMode] = useState<TravelMode>('driving')
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [toast, setToast] = useState('')

  const loadPandals = useAppStore((state) => state.loadPandals)
  const setError = useAppStore((state) => state.setError)
  const showApproximateBanner = (app.locationStatus === 'denied' || app.locationStatus === 'unavailable') && !approximateBannerDismissed

  useEffect(() => { void loadPandals() }, [loadPandals])

  useEffect(() => {
    if (!app.error) return
    const timeout = window.setTimeout(() => {
      setError(null)
    }, 4200)
    return () => window.clearTimeout(timeout)
  }, [app.error, setError])

  const distanceFromUser = (pandal: { lat: number; lng: number }) => haversine(app.userLocation, pandal)
  const visiblePandals = app.pandals
    .filter((pandal) => distanceFromUser(pandal) <= app.radiusKm)
    .sort((a, b) => distanceFromUser(a) - distanceFromUser(b))
  const visitingIds = new Set(app.visitingList.map((pandal) => pandal.id))

  function chooseLocation() {
    setPermissionOpen(false)
    requestLocation()
  }

  function chooseApproximate() {
    setPermissionOpen(false)
    setApproximateLocation()
  }

  async function handlePlanRoute(preference: RoutePreference = routePreference, mode: TravelMode = travelMode) {
    if (!app.visitingList.length) return
    setRouteBusy(true)
    app.setError(null)
    try {
      const route = await planRoute({ origin: app.userLocation, pandalIds: app.visitingList.map((pandal) => pandal.id), algorithm: 'astar', preference, travelMode: mode })
      app.setRoutePlan(route)
      setRoutePreference(preference)
      setTravelMode(mode)
      setDirectionsOpen(false)
      setDrawerOpen(false)
    } catch (error) {
      app.setError(error instanceof Error ? error.message : 'Unable to plan your route.')
    } finally {
      setRouteBusy(false)
    }
  }

  function addPandal(pandal: typeof app.visitingList[number]) {
    app.addToRoute(pandal)
    setToast(`${pandal.name} added to your route`)
    window.setTimeout(() => setToast(''), 2400)
  }

  return (
    <main className="planner-shell">
      <MapView userLocation={app.userLocation} selectedZone={app.selectedZone} pandals={visiblePandals} routePlan={app.routePlan} visitingIds={visitingIds} onAdd={addPandal} distanceFromUser={distanceFromUser} />
      <header className="app-header">
        <div className="brand-block"><div className="brand-seal" aria-hidden="true"><span>শ</span></div><div className="brand-copy"><h1>Pandal Hopper</h1><p>SUBHO PUJO <i /> KOLKATA</p></div></div>
        <div className="header-actions"><span className="season-pill"><span className="season-dot" /> Pujo season</span><button className="list-trigger" type="button" onClick={() => setDrawerOpen(true)} aria-label={`Open visiting list, ${app.visitingList.length} stops`} aria-expanded={drawerOpen}><ListChecks size={18} /><span className="list-trigger-label">My list</span><span className="list-count">{app.visitingList.length}</span></button></div>
      </header>
      <div className="map-status-strip"><span className="status-location"><MapPin size={14} /><span>{app.locationStatus === 'granted' ? 'Your location' : 'Kolkata, West Bengal'}</span><ChevronDown size={13} /></span><span className="pandal-total">{app.isLoading ? 'Finding pandals…' : `${visiblePandals.length} pandals nearby`}</span></div>
      {showApproximateBanner && <div className="approximate-banner" role="status"><LocateFixed size={15} /><span>Using approximate location.</span><button type="button" aria-label="Dismiss approximate location notice" onClick={() => setApproximateBannerDismissed(true)}><X size={14} /></button></div>}
      <div className="map-tools"><button className="map-tool-button" type="button" aria-label="Recenter map" onClick={() => window.dispatchEvent(new CustomEvent('pandal-recenter'))}><LocateFixed size={17} /></button></div>
      {app.isLoading && <div className="map-loading" aria-label="Loading pandals"><span /><span /><span /></div>}
      {!app.isLoading && visiblePandals.length === 0 && <div className="map-empty" role="status"><div className="empty-map-icon"><MapPin size={17} /></div><div><strong>No pandals in this radius</strong><span>Try a wider search or another zone.</span></div></div>}
      {app.routePlan && directionsOpen && <DirectionsPanel routePlan={app.routePlan} onBack={() => setDirectionsOpen(false)} />}
      {app.routePlan && !directionsOpen && <RouteSummary routePlan={app.routePlan} onReoptimize={() => { void handlePlanRoute(routePreference, travelMode) }} onPreferenceChange={(preference) => { void handlePlanRoute(preference, travelMode) }} onTravelModeChange={(mode) => { void handlePlanRoute(routePreference, mode) }} onDirections={() => setDirectionsOpen(true)} onClose={() => app.setRoutePlan(null)} busy={routeBusy} />}
      <ZoneBar selectedZone={app.selectedZone} radiusKm={app.radiusKm} travelMode={travelMode} onTravelModeChange={(mode) => { if (app.routePlan) void handlePlanRoute(routePreference, mode); else setTravelMode(mode) }} onZoneChange={(zone) => { if (zone === 'Kalyani') app.setRadiusKm(Math.max(app.radiusKm, 60)); if (zone === 'Other areas') app.setRadiusKm(Math.max(app.radiusKm, 30)); void app.setSelectedZone(zone) }} onRadiusChange={app.setRadiusKm} onPlanRoute={() => handlePlanRoute(routePreference, travelMode)} routeBusy={routeBusy} stopCount={app.visitingList.length} />
      <VisitingDrawer open={drawerOpen} pandals={app.visitingList} onClose={() => setDrawerOpen(false)} onRemove={app.removeFromRoute} onReorder={app.reorderVisitingList} />
      {(toast || app.error) && <div className="toast-message" role="status"><Bell size={15} />{toast || app.error}<button aria-label="Dismiss notification" onClick={() => { setToast(''); setError(null) }}><X size={13} /></button></div>}
      {permissionOpen && <PermissionModal onUseLocation={chooseLocation} onUseApproximate={chooseApproximate} />}
    </main>
  )
}

export default App
