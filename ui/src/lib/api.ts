import { getGuestId } from "./utils"

const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'

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