import { BASE_URL } from '@/lib/api'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

type ModerationSocketMessage =
  | { type: 'connected' }
  | {
      type: 'moderation_result'
      report_data: string
      is_flagged: boolean
      reason?: string | null
    }

const API_URL = BASE_URL

function getModerationSocketUrl(): string {
  return `${API_URL.replace(/\/$/, '').replace(/^http/, 'ws')}/ws/reports/moderation`
}

export function ModerationSocket() {
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let shouldReconnect = true

    const ws = new WebSocket(getModerationSocketUrl())
    wsRef.current = ws

    ws.onmessage = (event) => {
      if (!shouldReconnect || wsRef.current !== ws) return

      const message = JSON.parse(event.data) as ModerationSocketMessage

      // if (message.type === 'connected') {
      //   toast.info('Realtime validasi terhubung.')
      //   return
      // }

      if (message.type !== 'moderation_result') return

      if (!message.is_flagged) {
        toast.success(`Laporan diterima — ${message.report_data}`)
        return
      }

      toast.error(`Laporan ditolak: ${message.reason} — ${message.report_data}`)
    }

    ws.onerror = (event) => {
      if (shouldReconnect && wsRef.current === ws) {
        console.error('WebSocket Error Detail:', event)
        toast.warning('Realtime validasi terputus.')
      }
    }

    return () => {
      shouldReconnect = false

      if (wsRef.current === ws) {
        wsRef.current = null
      }

      ws.close()
    }
  }, [])

  return null
}
