import { z } from 'zod'

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432').transform((val) => parseInt(val, 10)),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional().nullable(),
  REDIS_DB: z.string().default('0').transform((val) => parseInt(val, 10)),
  
  AI_API_KEY: z.string()
})

const parsed = envSchema.safeParse(Bun.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format())
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
