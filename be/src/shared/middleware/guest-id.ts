import type { MiddlewareHandler } from 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    guestId: string
  }
}

export const guestIdMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    let guestId = c.req.header('x-guest-id') || c.req.header('X-Guest-ID')
    
    if (!guestId || guestId.trim() === '') {
      guestId = crypto.randomUUID()
    }
    
    c.set('guestId', guestId)
    
    c.header('x-guest-id', guestId)
    
    await next()
  }
}
