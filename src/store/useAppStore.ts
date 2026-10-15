import { create } from 'zustand'
import { getPandals } from '../services/api'
import type { LatLng, LocationStatus, Pandal, RoutePlan, ZoneFilter } from '../types'

const KOLKATA_CENTER: LatLng = { lat: 22.5726, lng: 88.3639 }

interface AppState {
  userLocation: LatLng
  locationStatus: LocationStatus
  selectedZone: ZoneFilter
  radiusKm: number
  pandals: Pandal[]
  visitingList: Pandal[]
  routePlan: RoutePlan | null
  isLoading: boolean
  error: string | null
  setUserLocation: (location: LatLng, status: LocationStatus) => void
  setLocationStatus: (status: LocationStatus) => void
  setSelectedZone: (zone: ZoneFilter) => Promise<void>
  setRadiusKm: (radiusKm: number) => void
  loadPandals: () => Promise<void>
  addToRoute: (pandal: Pandal) => void
  removeFromRoute: (id: string) => void
  reorderVisitingList: (activeId: string, overId: string) => void
  setRoutePlan: (routePlan: RoutePlan | null) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  userLocation: KOLKATA_CENTER,
  locationStatus: 'idle',
  selectedZone: 'All',
  radiusKm: 12,
  pandals: [],
  visitingList: [],
  routePlan: null,
  isLoading: false,
  error: null,
  setUserLocation: (userLocation, locationStatus) => set({ userLocation, locationStatus }),
  setLocationStatus: (locationStatus) => set({ locationStatus }),
  setSelectedZone: async (selectedZone) => {
    set({ selectedZone, routePlan: null })
    await get().loadPandals()
  },
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  loadPandals: async () => {
    const { selectedZone } = get()
    set({ isLoading: true, error: null })
    try {
      const pandals = await getPandals(selectedZone === 'All' ? undefined : selectedZone)
      set({ pandals, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Something went wrong.', isLoading: false })
    }
  },
  addToRoute: (pandal) => {
    const visitingList = get().visitingList
    if (visitingList.some((stop) => stop.id === pandal.id)) return
    set({ visitingList: [...visitingList, pandal], routePlan: null })
  },
  removeFromRoute: (id) =>
    set({ visitingList: get().visitingList.filter((pandal) => pandal.id !== id), routePlan: null }),
  reorderVisitingList: (activeId, overId) => {
    const visitingList = [...get().visitingList]
    const activeIndex = visitingList.findIndex((pandal) => pandal.id === activeId)
    const overIndex = visitingList.findIndex((pandal) => pandal.id === overId)
    if (activeIndex < 0 || overIndex < 0) return
    const [moved] = visitingList.splice(activeIndex, 1)
    visitingList.splice(overIndex, 0, moved)
    set({ visitingList, routePlan: null })
  },
  setRoutePlan: (routePlan) => set({ routePlan }),
  setError: (error) => set({ error }),
}))
