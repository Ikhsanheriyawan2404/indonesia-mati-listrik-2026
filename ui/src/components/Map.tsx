import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { api } from '@/lib/api'
import { useLocation } from '@/lib/LocationContext'
import { type Report, type ApiResponse, reportsToGeoJSON } from '@/lib/types'

const REPORTS_SOURCE = 'reports'
const CLUSTERS_LAYER = 'clusters'
const CLUSTER_COUNT_LAYER = 'cluster-count'
const UNCLUSTERED_LAYER = 'unclustered-point'
const OPEN_REPORT_MODAL_EVENT = 'open-report-modal'
const LONG_PRESS_MS = 650

function formatReportTime(startedAtStr: string | null): string {
  if (!startedAtStr) return ''
  const date = new Date(startedAtStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours >= 0 && diffHours < 24) {
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 1) return 'baru saja'
    if (diffMins < 60) return `${diffMins} menit yang lalu`
    const hours = Math.floor(diffHours)
    return `${hours} jam yang lalu`
  } else if (diffHours < 0 && Math.abs(diffHours) < 24) {
    const diffMins = Math.floor(Math.abs(diffMs) / (1000 * 60))
    if (diffMins < 1) return 'sebentar lagi'
    if (diffMins < 60) return `${diffMins} menit lagi`
    const hours = Math.floor(Math.abs(diffHours))
    return `${hours} jam lagi`
  } else {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    const day = date.getDate()
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day} ${month} ${year}, ${hours}:${minutes}`
  }
}

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { registerMap, selectPoint } = useLocation()

  const fetchReports = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds()
    if (!bounds) return

    const params = new URLSearchParams({
      minLng: String(bounds.getWest()),
      minLat: String(bounds.getSouth()),
      maxLng: String(bounds.getEast()),
      maxLat: String(bounds.getNorth()),
    })

    try {
      const res = await api<ApiResponse<Report[]>>(`/reports?${params.toString()}`)
      const reports = res.data ?? []

      const source = map.getSource(REPORTS_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!source) return

      source.setData(reportsToGeoJSON(reports))
    } catch {}
  }, [])

  const handleMoveEnd = useCallback(
    (map: maplibregl.Map) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        fetchReports(map)
      }, 300)
    },
    [fetchReports]
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [118, -1],
      zoom: 4.5,
      style: {
        version: 8,
        sources: {
          'osm-raster-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-raster-layer',
            type: 'raster',
            source: 'osm-raster-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
    })

    mapRef.current = map
    registerMap(map)
    mapRef.current?.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current?.addControl(
      new maplibregl.GeolocateControl({ trackUserLocation: true }),
      "top-right"
    );

    map.on('load', () => {
      // GeoJSON source with clustering enabled
      map.addSource(REPORTS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: {
          // Aggregate history/schedule counts for majority-rule cluster color
          history_count: ['+', ['case', ['==', ['get', 'status'], 'history'], 1, 0]],
          schedule_count: ['+', ['case', ['==', ['get', 'status'], 'schedule'], 1, 0]],
        },
      })

      // Cluster circle — majority-rule color
      map.addLayer({
        id: CLUSTERS_LAYER,
        type: 'circle',
        source: REPORTS_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'case',
            ['>', ['get', 'schedule_count'], ['get', 'history_count']],
            '#3b82f6', // majority schedule → blue
            '#ef4444', // otherwise (majority history or tie) → red
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 100, 28],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
        },
      })

      // Cluster count label
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: REPORTS_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      })

      // Individual (unclustered) point
      map.addLayer({
        id: UNCLUSTERED_LAYER,
        type: 'circle',
        source: REPORTS_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'history'],
            '#ef4444',
            '#3b82f6',
          ],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Initial data fetch
      fetchReports(map)

      // Debounced fetch on viewport change
      map.on('moveend', () => handleMoveEnd(map))

      // Click cluster → zoom in to expand
      map.on('click', CLUSTERS_LAYER, (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const clusterId = feature.properties?.cluster_id as number
        const source = map.getSource(REPORTS_SOURCE) as maplibregl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId)
      })

      // Click individual point → popup detail
      map.on('click', UNCLUSTERED_LAYER, (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const props = feature.properties ?? {}
        const coords = feature.geometry.coordinates as [number, number]

        const formattedTime = formatReportTime(props.started_at)
        const reporterName = props.reporter_name || 'Anonim'

        const badgeHtml = props.status === 'history'
          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
              <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              Riwayat Padam
             </span>`
          : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Info / Jadwal
             </span>`

        const descHtml = props.description
          ? `<div class="bg-muted/40 p-2 rounded-md border border-border/20 text-xs italic text-foreground/90 break-words leading-normal">
              "${props.description}"
             </div>`
          : ''

        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '270px' })
          .setLngLat(coords)
          .setHTML(
            `<div class="flex flex-col gap-2.5 w-60 py-1 font-sans">
              <!-- Top header row: Badge & Source -->
              <div class="flex items-center justify-between">
                ${badgeHtml}
                <div class="text-xs text-muted-foreground">#${props.id}</div>
              </div>

              <!-- Reporter info & Time -->
              <div class="flex flex-col gap-1 text-xs text-muted-foreground border-b border-border/40 pb-2">
                <div class="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/60"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span class="font-medium text-foreground">${reporterName}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/60"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>${formattedTime}</span>
                </div>
              </div>

              <!-- Description -->
              ${descHtml}

              <!-- Voting section (static) -->
              <div class="flex items-center justify-between border-t border-border/40 pt-2">
                <span class="text-[11px] font-medium text-muted-foreground">Validasi?</span>
                <div class="flex items-center gap-1.5">
                  <button class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted text-muted-foreground text-xs font-semibold cursor-not-allowed opacity-80" disabled aria-label="Upvote">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><path d="m18 15-6-6-6 6"/></svg>
                    <span class="text-[11px]">0</span>
                  </button>
                  <button class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted text-muted-foreground text-xs font-semibold cursor-not-allowed opacity-80" disabled aria-label="Downvote">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-rose-600"><path d="m6 9 6 6 6-6"/></svg>
                    <span class="text-[11px]">0</span>
                  </button>
                </div>
              </div>
            </div>`
          )
          .addTo(map)
      })

      // Cursor feedback
      const setCursorPointer = () => { map.getCanvas().style.cursor = 'pointer' }
      const setCursorDefault = () => { map.getCanvas().style.cursor = '' }
      map.on('mouseenter', CLUSTERS_LAYER, setCursorPointer)
      map.on('mouseleave', CLUSTERS_LAYER, setCursorDefault)
      map.on('mouseenter', UNCLUSTERED_LAYER, setCursorPointer)
      map.on('mouseleave', UNCLUSTERED_LAYER, setCursorDefault)
    })

    const clearLongPress = () => {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current)
        longPressRef.current = null
      }
    }

    const startLongPress = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
      clearLongPress()

      const { lat, lng } = e.lngLat
      longPressRef.current = setTimeout(() => {
        selectPoint({ latitude: lat, longitude: lng })
        window.dispatchEvent(new Event(OPEN_REPORT_MODAL_EVENT))
        longPressRef.current = null
      }, LONG_PRESS_MS)
    }

    map.on('mousedown', startLongPress)
    map.on('touchstart', startLongPress)
    map.on('mouseup', clearLongPress)
    map.on('touchend', clearLongPress)
    map.on('mousemove', clearLongPress)
    map.on('touchmove', clearLongPress)
    map.on('dragstart', clearLongPress)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (longPressRef.current) clearTimeout(longPressRef.current)
      if (popupRef.current) popupRef.current.remove()
      map.remove()
      mapRef.current = null
    }
  }, [fetchReports, handleMoveEnd, registerMap, selectPoint])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ width: '100%', height: '100%' }}
      role="application"
      aria-label="Peta laporan mati listrik"
    ></div>
  )
}
