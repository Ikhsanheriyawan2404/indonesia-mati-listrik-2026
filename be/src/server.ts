import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ZodError } from 'zod'
import { initDatabase } from './config/database'
import { env } from './config/env'
import reportsRouter from './modules/reports/report.route'
import { rateLimiter } from './shared/middleware/rate-limiter'

await initDatabase()

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'X-Guest-ID', 'x-guest-id'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Type', 'X-Guest-ID', 'x-guest-id'],
  maxAge: 600,
}))

app.use('*', rateLimiter(500))

app.get('/health', (c) => {
  return c.json({
    status: 'UP',
    timestamp: new Date().toISOString()
  })
})

// routing disini
app.route('/reports', reportsRouter)

app.onError((err, c) => {

  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    console.error(`[Error] Malformed JSON: ${err.message}`)
    return c.json({
      error: 'BadRequestError',
      message: 'Format JSON yang Anda kirim tidak valid.'
    }, 400)
  }
  
  if (err instanceof ZodError) {
    console.error(`[Error] ${err.name}: ${err.message}`)
    
    const errorDetails = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }))
    
    return c.json({
      error: 'Validation Error',
      message: 'Ada kesalahan pada input data Anda.',
      errors: errorDetails
    }, 400)
  }

  const status = (err as any).status
  if (status && typeof status === 'number') {
    console.error(`[Error] ${err.name}: ${err.message}`)
    return c.json({
      error: err.name,
      message: err.message
    }, status as any)
  }

  console.error(`[Error] ${err.name}: ${err.message}`, err.stack)
  return c.json({
    error: 'Internal Server Error',
    message: 'Terjadi kesalahan internal pada server.'
  }, 500)
})

export default {
  port: env.PORT,
  fetch: app.fetch
}
