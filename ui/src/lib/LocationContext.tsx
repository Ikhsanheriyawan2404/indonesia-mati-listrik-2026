import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import maplibregl from 'maplibre-gl'

type LatLng = { latitude: number; longitude: number }

type LocationContextType = {
  selected: LatLng | null
  setSelected: (loc: LatLng | null) => void
  selectCenter: () => void
  selectPoint: (loc: LatLng) => void
  clearTemporaryMarker: () => void
  finalizeMarker: () => void
  registerMap: (map: maplibregl.Map) => void
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<LatLng | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null)

  const placeTemporaryMarker = useCallback((loc: LatLng) => {
    if (!mapRef.current) return

    if (tempMarkerRef.current) tempMarkerRef.current.remove()
    tempMarkerRef.current = new maplibregl.Marker({ color: '#f59e0b' })
      .setLngLat([loc.longitude, loc.latitude])
      .addTo(mapRef.current)
  }, [])

  const selectCenter = useCallback(() => {
    if (!mapRef.current) return

    const center = mapRef.current.getCenter()
    const loc = { latitude: center.lat, longitude: center.lng }
    setSelected(loc)
    placeTemporaryMarker(loc)
  }, [placeTemporaryMarker])

  const selectPoint = useCallback((loc: LatLng) => {
    if (!mapRef.current) return

    setSelected(loc)
    placeTemporaryMarker(loc)
    mapRef.current.easeTo({
      center: [loc.longitude, loc.latitude],
      zoom: mapRef.current.getZoom(),
      duration: 350,
    })
  }, [placeTemporaryMarker])

  const clearTemporaryMarker = useCallback(() => {
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove()
      tempMarkerRef.current = null
    }
    setSelected(null)
  }, [])

  const finalizeMarker = useCallback(() => {
    setSelected(null)
    tempMarkerRef.current = null
  }, [])

  const registerMap = useCallback((map: maplibregl.Map) => {
    mapRef.current = map
  }, [])

  const value: LocationContextType = {
    selected,
    setSelected,
    selectCenter,
    selectPoint,
    clearTemporaryMarker,
    finalizeMarker,
    registerMap,
  }

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used within LocationProvider')
  return ctx
}
