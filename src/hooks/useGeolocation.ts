import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { LatLng } from '../types'

const KOLKATA_CENTER: LatLng = { lat: 22.5726, lng: 88.3639 }

export function useGeolocation() {
  const setLocation = useAppStore((state) => state.setUserLocation)
  const setStatus = useAppStore((state) => state.setLocationStatus)

  const setApproximateLocation = useCallback(() => {
    setLocation(KOLKATA_CENTER, 'unavailable')
  }, [setLocation])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(KOLKATA_CENTER, 'unavailable')
      return
    }

    setStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lng: coords.longitude }, 'granted')
      },
      (error) => {
        setLocation(KOLKATA_CENTER, error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [setLocation, setStatus])

  return { requestLocation, setApproximateLocation }
}
