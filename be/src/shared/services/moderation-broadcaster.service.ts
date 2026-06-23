import type { WSContext } from 'hono/ws'

const MODERATION_TOPIC = 'reports:moderation'
const MAX_MESSAGE_SIZE = 1024

export interface ModerationBroadcastPayload {
  type: 'moderation_result'
  report_data: string
  is_flagged: boolean
  reason?: string | null
}

type BunPubSubWebSocket = {
  readyState: number
  send(data: string | ArrayBuffer | Uint8Array): void
  subscribe?(topic: string): void
  unsubscribe?(topic: string): void
  publish?(topic: string, data: string): number
}

export class ModerationBroadcasterService {
  private readonly clients = new Set<BunPubSubWebSocket>()
  private server: any = null
  
  setServer(server: any): void {
    this.server = server
  }

  add(client: WSContext): void {
    const raw = client.raw as BunPubSubWebSocket | undefined
    if (!raw) return

    raw.subscribe?.(MODERATION_TOPIC)
    this.clients.add(raw)
  }

  remove(client: WSContext): void {
    const raw = client.raw as BunPubSubWebSocket | undefined
    if (!raw) return

    raw.unsubscribe?.(MODERATION_TOPIC)
    this.clients.delete(raw)
  }

  handleMessage(client: WSContext, rawMessage: unknown): void {
    const size = this.getMessageSize(rawMessage)

    if (size > MAX_MESSAGE_SIZE) {
      console.warn(`[WebSocket] rejected oversized message size=${size}`)
      client.close(1009, 'Message too large')
      return
    }

    if (typeof rawMessage !== 'string') return

    try {
      JSON.parse(rawMessage)
    } catch (error) {
      console.warn('[WebSocket] invalid JSON message', error)
    }
  }

  broadcast(payload: ModerationBroadcastPayload): void {
    const message = JSON.stringify(payload)

    if (this.server) {
      this.server.publish(MODERATION_TOPIC, message)
      return
    }

    for (const client of this.clients) {
      if (client.readyState === 1) client.send(message)
    }
  }

  private getPublisher(): BunPubSubWebSocket | null {
    for (const client of this.clients) {
      if (client.readyState === 1) return client
    }

    return null
  }

  private getMessageSize(rawMessage: unknown): number {
    if (typeof rawMessage === 'string') return rawMessage.length
    if (rawMessage instanceof ArrayBuffer) return rawMessage.byteLength
    if (rawMessage instanceof Blob) return rawMessage.size

    return 0
  }
}

export const moderationBroadcaster = new ModerationBroadcasterService()
