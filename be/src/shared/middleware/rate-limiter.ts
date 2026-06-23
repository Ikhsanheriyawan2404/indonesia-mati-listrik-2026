import type { MiddlewareHandler } from 'hono'
import { getConnInfo } from 'hono/bun'
import { redis } from '../../config/redis'

export const rateLimiter = (windowMs = 1_000): MiddlewareHandler => {
  return async (c, next) => {
    const conn = getConnInfo(c)
    const socketIp = conn.remote.address ?? 'unknown'

    const key = `rl:${socketIp}`

    const result = await redis.set(key, '1', 'PX', windowMs, 'NX')

    if (result === null) {
      return c.json({
        error: 'Too Many Requests',
        message: 'Batas limitasi request terlampaui.'
      }, 429)
    }

    await next()
  }
}