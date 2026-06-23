import postgres from 'postgres'
import { env } from './env'

export const sql = postgres({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: (notice) => {
    if (env.NODE_ENV !== 'development') {
      console.info(`[PG ${notice.severity}]: ${notice.message}`)
    } else if (notice.severity === 'WARNING') {
      console.warn(`[PG WARNING]: ${notice.message}`)
    }
  }
})

export async function initDatabase() {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS postgis;`
    
    await sql`
      CREATE TABLE IF NOT EXISTS reports (
        id            BIGSERIAL PRIMARY KEY,
        guest_id      VARCHAR(36)   NOT NULL,
        reporter_name VARCHAR(100),
        location      GEOMETRY(POINT, 4326) NOT NULL,
        description   TEXT,
        started_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        ended_at      TIMESTAMPTZ,
        source        VARCHAR(50)   NOT NULL DEFAULT 'CROWDSOURCED',
        is_flagged    BOOLEAN       NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reports_location
        ON reports USING GIST(location);
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reports_started_at
        ON reports(started_at DESC);
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reports_is_flagged
        ON reports(is_flagged)
        WHERE is_flagged = false;
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reports_location_active
        ON reports USING GIST(location)
        WHERE is_flagged = false;
    `
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE vote_type AS ENUM ('UP', 'DOWN');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `
    
    await sql`
      CREATE TABLE IF NOT EXISTS votes (
        id          BIGSERIAL PRIMARY KEY,
        report_id   BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        guest_id    VARCHAR(36) NOT NULL,
        vote_type   vote_type NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE(report_id, guest_id)
      );
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_votes_report_id
        ON votes(report_id);
    `
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}
