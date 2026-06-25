import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useLocation } from '@/lib/LocationContext'
import { type Report, type ApiResponse, reportsToGeoJSON } from '@/lib/types'

const REPORTS_SOURCE = 'reports'
const CLUSTERS_LAYER = 'clusters'
const CLUSTER_COUNT_LAYER = 'cluster-count'
const UNCLUSTERED_LAYER = 'unclustered-point'
const OPEN_REPORT_MODAL_EVENT = 'open-report-modal'
const TEMP_REPORT_EVENT = 'temp-report'
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
  const reportsRef = useRef<Report[]>([])
  const { registerMap, selectPoint } = useLocation()

  const setReportsData = useCallback((map: maplibregl.Map, reports: Report[]) => {
    reportsRef.current = reports

    const source = map.getSource(REPORTS_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    source.setData(reportsToGeoJSON(reports))
  }, [])

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

      setReportsData(map, reports)
    } catch {}
  }, [setReportsData])

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

    const handleTempReport = (event: Event) => {
      const report = (event as CustomEvent<Report>).detail
      if (!report?.id) return

      const nextReports = [
        report,
        ...reportsRef.current.filter((item) => item.id !== report.id),
      ]

      setReportsData(map, nextReports)
    }

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

      window.addEventListener(TEMP_REPORT_EVENT, handleTempReport as EventListener)

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

        // ─── Helpers ─────────────────────────────────────────────────────────

        /** Create an SVG element from a raw path string */
        const makeSvg = (pathD: string, color?: string): SVGSVGElement => {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          svg.setAttribute('width', '12')
          svg.setAttribute('height', '12')
          svg.setAttribute('viewBox', '0 0 24 24')
          svg.setAttribute('fill', 'none')
          svg.setAttribute('stroke', 'currentColor')
          svg.setAttribute('stroke-width', '2')
          svg.setAttribute('stroke-linecap', 'round')
          svg.setAttribute('stroke-linejoin', 'round')
          if (color) svg.style.color = color
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          path.setAttribute('d', pathD)
          svg.appendChild(path)
          return svg
        }

        const makeEl = <K extends keyof HTMLElementTagNameMap>(
          tag: K,
          cls: string,
          text?: string
        ): HTMLElementTagNameMap[K] => {
          const el = document.createElement(tag)
          el.className = cls
          if (text !== undefined) el.textContent = text
          return el
        }

        // ─── Root container ───────────────────────────────────────────────────
        const root = makeEl('div', 'flex flex-col gap-2.5 w-60 py-1 font-sans')

        // ─── Header row (badge + id) ──────────────────────────────────────────
        const headerRow = makeEl('div', 'flex items-center justify-between')

        const badge = makeEl('span',
          props.status === 'history'
            ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
        )
        const badgeDot = makeEl('span',
          props.status === 'history'
            ? 'w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse'
            : 'w-1.5 h-1.5 rounded-full bg-blue-500'
        )
        badge.appendChild(badgeDot)
        badge.appendChild(document.createTextNode(props.status === 'history' ? ' Riwayat Padam' : ' Info / Jadwal'))

        const idLabel = makeEl('div', 'text-xs text-muted-foreground', `#${props.id}`)
        headerRow.appendChild(badge)
        headerRow.appendChild(idLabel)
        root.appendChild(headerRow)

        // ─── Reporter + time row ──────────────────────────────────────────────
        const metaRow = makeEl('div', 'flex flex-col gap-1 text-xs text-muted-foreground border-b border-border/40 pb-2')

        const reporterRow = makeEl('div', 'flex items-center gap-1.5')
        const userSvg = makeSvg('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2')
        const circlePath = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circlePath.setAttribute('cx', '12'); circlePath.setAttribute('cy', '7'); circlePath.setAttribute('r', '4')
        userSvg.appendChild(circlePath)
        userSvg.style.color = 'var(--muted-foreground)'
        reporterRow.appendChild(userSvg)
        reporterRow.appendChild(makeEl('span', 'font-medium text-foreground', reporterName))
        metaRow.appendChild(reporterRow)

        const timeRow = makeEl('div', 'flex items-center gap-1.5')
        const clockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        clockSvg.setAttribute('width', '12'); clockSvg.setAttribute('height', '12')
        clockSvg.setAttribute('viewBox', '0 0 24 24'); clockSvg.setAttribute('fill', 'none')
        clockSvg.setAttribute('stroke', 'currentColor'); clockSvg.setAttribute('stroke-width', '2')
        clockSvg.setAttribute('stroke-linecap', 'round'); clockSvg.setAttribute('stroke-linejoin', 'round')
        clockSvg.style.color = 'var(--muted-foreground)'
        const clockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        clockCircle.setAttribute('cx', '12'); clockCircle.setAttribute('cy', '12'); clockCircle.setAttribute('r', '10')
        const clockPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
        clockPolyline.setAttribute('points', '12 6 12 12 16 14')
        clockSvg.appendChild(clockCircle); clockSvg.appendChild(clockPolyline)
        timeRow.appendChild(clockSvg)
        timeRow.appendChild(makeEl('span', '', formattedTime))
        metaRow.appendChild(timeRow)
        root.appendChild(metaRow)

        // ─── Description ──────────────────────────────────────────────────────
        if (props.description) {
          const descBox = makeEl('div', 'bg-muted/40 p-2 rounded-md border border-border/20 text-xs italic text-foreground/90 break-words leading-normal')
          descBox.textContent = `"${props.description}"`
          root.appendChild(descBox)
        }

        // ─── Voting section ───────────────────────────────────────────────────
        const voteRow = makeEl('div', 'flex items-center justify-between border-t border-border/40 pt-2')
        voteRow.appendChild(makeEl('span', 'text-[11px] font-medium text-muted-foreground', 'Validasi?'))

        const voteBtnsWrap = makeEl('div', 'flex items-center gap-1.5')

        // Chevron UP svg
        const makeChevronSvg = (direction: 'up' | 'down', colorClass: string): SVGSVGElement => {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          svg.setAttribute('width', '12'); svg.setAttribute('height', '12')
          svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none')
          svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.5')
          svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round')
          svg.setAttribute('class', colorClass)
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          p.setAttribute('d', direction === 'up' ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6')
          svg.appendChild(p)
          return svg
        }

        const upCountSpan   = makeEl('span', 'text-[11px]', '—')
        const downCountSpan = makeEl('span', 'text-[11px]', '—')

        const upBtn = makeEl('button', 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-semibold opacity-60 cursor-not-allowed')
        upBtn.setAttribute('disabled', 'true')
        upBtn.setAttribute('aria-label', 'Upvote')
        upBtn.appendChild(makeChevronSvg('up', 'text-emerald-600'))
        upBtn.appendChild(upCountSpan)

        const downBtn = makeEl('button', 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-semibold opacity-60 cursor-not-allowed')
        downBtn.setAttribute('disabled', 'true')
        downBtn.setAttribute('aria-label', 'Downvote')
        downBtn.appendChild(makeChevronSvg('down', 'text-rose-600'))
        downBtn.appendChild(downCountSpan)

        voteBtnsWrap.appendChild(upBtn)
        voteBtnsWrap.appendChild(downBtn)
        voteRow.appendChild(voteBtnsWrap)
        root.appendChild(voteRow)

        // ─── Delete section (hidden until fetch confirms is_mine) ─────────────
        const deleteSection = makeEl('div', '') // hidden until confirmed
        root.appendChild(deleteSection)

        // ─── Vote state ───────────────────────────────────────────────────────
        let currentUserVote: string | null = null
        let currentUpCount   = 0
        let currentDownCount = 0
        let isVoting = false

        const IDLE_CLASS        = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-colors duration-150 bg-muted text-muted-foreground hover:bg-muted/80'
        const ACTIVE_UP_CLASS   = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-colors duration-150 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 ring-1 ring-emerald-400/40'
        const ACTIVE_DOWN_CLASS = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-colors duration-150 bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 ring-1 ring-rose-400/40'

        /** Sync vote button appearance — uses direct DOM refs, no querySelector */
        const syncVoteUI = (upCount: number, downCount: number, userVote: string | null, loading: boolean) => {
          upCountSpan.textContent   = String(upCount)
          downCountSpan.textContent = String(downCount)

          upBtn.className   = loading ? IDLE_CLASS + ' opacity-60 cursor-not-allowed' : (userVote === 'UP'   ? ACTIVE_UP_CLASS   : IDLE_CLASS)
          downBtn.className = loading ? IDLE_CLASS + ' opacity-60 cursor-not-allowed' : (userVote === 'DOWN' ? ACTIVE_DOWN_CLASS : IDLE_CLASS)

          if (loading) {
            upBtn.setAttribute('disabled', 'true')
            downBtn.setAttribute('disabled', 'true')
          } else {
            upBtn.removeAttribute('disabled')
            downBtn.removeAttribute('disabled')
          }
        }

        const handleVote = async (voteType: 'UP' | 'DOWN') => {
          if (isVoting) return
          isVoting = true
          syncVoteUI(currentUpCount, currentDownCount, currentUserVote, true)

          await new Promise(resolve => setTimeout(resolve, 1000))

          try {
            const res = await api<{ message: string; data: { up_count: number; down_count: number; user_vote: string | null } }>(
              `/reports/${props.id}/votes`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vote_type: voteType }),
              }
            )
            currentUpCount   = res.data.up_count
            currentDownCount = res.data.down_count
            currentUserVote  = res.data.user_vote
            syncVoteUI(currentUpCount, currentDownCount, currentUserVote, false)
          } catch (err: any) {
            syncVoteUI(currentUpCount, currentDownCount, currentUserVote, false)
            if (err.status === 429) {
              toast.error('Batas limitasi request terlampaui. Silakan coba beberapa saat lagi.')
            } else {
              toast.error('Gagal memproses vote. Silakan coba lagi.')
            }
          } finally {
            isVoting = false
          }
        }

        upBtn.addEventListener('click', () => handleVote('UP'))
        downBtn.addEventListener('click', () => handleVote('DOWN'))

        // ─── Mount popup ──────────────────────────────────────────────────────
        if (popupRef.current) popupRef.current.remove()
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '270px' })
          .setLngLat(coords)
          .setDOMContent(root)
          .addTo(map)

        // ─── Fetch detail async → fill counts + reveal delete ─────────────────
        api<ApiResponse<Report & { is_mine: boolean; user_vote: string | null; up_count: number; down_count: number }>>(`/reports/${props.id}`, {
          headers: { 'Accept': 'application/json' }
        })
          .then((res) => {
            if (!res?.data) return

            currentUpCount   = res.data.up_count   ?? 0
            currentDownCount = res.data.down_count ?? 0
            currentUserVote  = res.data.user_vote  ?? null
            syncVoteUI(currentUpCount, currentDownCount, currentUserVote, false)

            if (res.data.is_mine) {
              // Build delete button via DOM API
              deleteSection.className = 'flex items-center justify-end border-t border-border/40 pt-2'

              const trashSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
              trashSvg.setAttribute('width', '12'); trashSvg.setAttribute('height', '12')
              trashSvg.setAttribute('viewBox', '0 0 24 24'); trashSvg.setAttribute('fill', 'none')
              trashSvg.setAttribute('stroke', 'currentColor'); trashSvg.setAttribute('stroke-width', '2')
              trashSvg.setAttribute('stroke-linecap', 'round'); trashSvg.setAttribute('stroke-linejoin', 'round')
              ;['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'].forEach(d => {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
                p.setAttribute('d', d)
                trashSvg.appendChild(p)
              })

              const deleteLabel = makeEl('span', '', 'Hapus')
              const deleteBtn = makeEl('button',
                'inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 text-[11px] font-semibold transition-colors duration-200'
              )
              deleteBtn.setAttribute('aria-label', 'Hapus laporan')
              deleteBtn.appendChild(trashSvg)
              deleteBtn.appendChild(deleteLabel)
              deleteSection.appendChild(deleteBtn)

              deleteBtn.addEventListener('click', async () => {
                if (!confirm('Apakah Anda yakin ingin menghapus laporan ini?')) return

                deleteBtn.setAttribute('disabled', 'true')
                deleteLabel.textContent = 'Menghapus...'
                trashSvg.style.display = 'none'

                try {
                  await api(`/reports/${props.id}`, { method: 'DELETE' })
                  toast.success('Laporan berhasil dihapus.')
                  popupRef.current?.remove()
                  fetchReports(map)
                } catch (err: any) {
                  deleteBtn.removeAttribute('disabled')
                  deleteLabel.textContent = 'Hapus'
                  trashSvg.style.display = ''
                  if (err.status === 429) {
                    toast.error('Batas limitasi request terlampaui. Silakan coba beberapa saat lagi.')
                  } else {
                    let msg = 'Gagal menghapus laporan.'
                    try { msg = JSON.parse(err.message)?.message || msg } catch { msg = err.message || msg }
                    toast.error(msg)
                  }
                }
              })
            }
          })
          .catch((err: any) => {
            if (err.status === 429) {
              toast.error('Batas limitasi request terlampaui. Silakan coba beberapa saat lagi.')
            }
          })
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
      window.removeEventListener(TEMP_REPORT_EVENT, handleTempReport as EventListener)
      map.remove()
      mapRef.current = null
    }
  }, [fetchReports, handleMoveEnd, registerMap, selectPoint, setReportsData])

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
