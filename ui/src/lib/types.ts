export type ReportStatus = 'history' | 'schedule'

export interface Report {
  id: string
  reporter_name: string | null
  latitude: number
  longitude: number
  description: string | null
  started_at: string | null
  ended_at: string | null
  source: string
  is_flagged: boolean
  created_at: string
  updated_at: string
  status: ReportStatus
}

export interface ApiResponse<T> {
  message: string
  data: T
}

/**
 * Convert array Report dari API ke GeoJSON FeatureCollection
 * siap dipakai sebagai MapLibre source data.
 */
export function reportsToGeoJSON(reports: Report[]): any {
  return {
    type: 'FeatureCollection',
    features: reports.map((r) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.longitude, r.latitude],
      },
      properties: {
        id: r.id,
        status: r.status,
        description: r.description ?? '',
        reporter_name: r.reporter_name ?? '',
        source: r.source,
        started_at: r.started_at,
        ended_at: r.ended_at,
      },
    })),
  }
}
