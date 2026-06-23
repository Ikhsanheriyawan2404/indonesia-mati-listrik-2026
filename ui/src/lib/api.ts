import { getGuestId } from "./utils"

export const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'

export const api = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Guest-ID': getGuestId(),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText || `HTTP Error! status: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'id',
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    return (data.display_name as string) ?? null
  } catch {
    return null
  }
}