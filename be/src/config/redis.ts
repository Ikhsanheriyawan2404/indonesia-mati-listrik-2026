import Redis from 'ioredis'
import { env } from './env'

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  }
})

redis.on('connect', () => {
  // console.info('Connected to Redis server successfully!')
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})
