import { sql } from '../../config/database'

export interface CreateReportDto {
  guest_id: string
  reporter_name?: string | null
  latitude: number
  longitude: number
  description?: string | null
  started_at?: string | null
  ended_at?: string | null
  source?: string
}

export interface Report {
  id: string
  guest_id: string
  reporter_name: string | null
  latitude: number
  longitude: number
  description: string | null
  started_at: Date
  ended_at: Date | null
  source: string
  is_flagged: boolean
  created_at: Date
  updated_at: Date
  status?: 'history' | 'schedule'
}

export type VoteType = 'UP' | 'DOWN'

export interface Vote {
  id: number
  report_id: number
  guest_id: string
  vote_type: VoteType
  created_at: Date
}

export type ReportDetail = Report & {
  is_mine: boolean
  user_vote: VoteType | null
  up_count: number
  down_count: number
}

export interface FindAllFilters {
  minLng?: number
  minLat?: number
  maxLng?: number
  maxLat?: number
}

export class ReportRepository {
  async create(data: CreateReportDto): Promise<Report> {
    const startedAtDate = data.started_at ? new Date(data.started_at) : new Date()
    const endedAtDate = data.ended_at ? new Date(data.ended_at) : null

    const [report] = await sql<Report[]>`
      INSERT INTO reports (
        guest_id, 
        reporter_name, 
        location, 
        description, 
        started_at, 
        ended_at
      ) VALUES (
        ${data.guest_id}, 
        ${data.reporter_name || null}, 
        ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326), 
        ${data.description || null}, 
        ${startedAtDate}, 
        ${endedAtDate}
      ) 
      RETURNING 
        id, 
        reporter_name, 
        ST_Y(location)::float AS latitude, 
        ST_X(location)::float AS longitude, 
        description, 
        started_at, 
        ended_at, 
        source, 
        is_flagged, 
        created_at, 
        updated_at
    `
    return report
  }

  async findAll(filters?: FindAllFilters): Promise<Report[]> {
    const hasBbox = filters?.minLng != null && filters?.minLat != null && filters?.maxLng != null && filters?.maxLat != null;
      
    if (hasBbox) {
      const minLng = filters.minLng as number
      const minLat = filters.minLat as number
      const maxLng = filters.maxLng as number
      const maxLat = filters.maxLat as number

      return await sql<Report[]>`
        SELECT 
          id, 
          reporter_name, 
          ST_Y(location)::float AS latitude, 
          ST_X(location)::float AS longitude, 
          description, 
          started_at, 
          ended_at, 
          source, 
          is_flagged, 
          created_at, 
          updated_at 
        FROM reports
        WHERE is_flagged = false
          AND ST_Intersects(location, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))
        ORDER BY started_at DESC
      `
    }

    return await sql<Report[]>`
      SELECT 
        id, 
        reporter_name, 
        ST_Y(location)::float AS latitude, 
        ST_X(location)::float AS longitude, 
        description, 
        started_at, 
        ended_at, 
        source, 
        is_flagged, 
        created_at, 
        updated_at 
      FROM reports
      WHERE is_flagged = false
      ORDER BY started_at DESC
      LIMIT 10
    `
  }

  async findById(id: number): Promise<Report | null> {
    const [report] = await sql<Report[]>`
      SELECT 
        r.id, 
        r.guest_id,
        r.reporter_name, 
        ST_Y(r.location)::float AS latitude, 
        ST_X(r.location)::float AS longitude, 
        r.description, 
        r.started_at, 
        r.ended_at, 
        r.source, 
        r.is_flagged, 
        r.created_at, 
        r.updated_at,
        COUNT(v.id) FILTER (WHERE v.vote_type = 'UP')   AS up_count,
        COUNT(v.id) FILTER (WHERE v.vote_type = 'DOWN') AS down_count
      FROM reports r
      LEFT JOIN votes v ON v.report_id = r.id
      WHERE r.id = ${id}
      GROUP BY r.id
    `
    return report || null
  }
  
  async getUserVote(reportId: number, guestId: string): Promise<VoteType | null> {
    const [row] = await sql<{ vote_type: VoteType }[]>`
      SELECT vote_type
      FROM votes
      WHERE report_id = ${reportId}
        AND guest_id  = ${guestId}
    `
    return row?.vote_type ?? null
  }

  /**
   * Smart toggle / switch logic:
   * - No existing vote  → INSERT new vote
   * - Same vote_type    → DELETE (toggle off)
   * - Diff vote_type    → UPDATE (switch side)
   */
  async toggleVote(reportId: number, guestId: string, voteType: VoteType): Promise<void> {
    const [existing] = await sql<{ id: number; vote_type: VoteType }[]>`
      SELECT id, vote_type
      FROM votes
      WHERE report_id = ${reportId}
        AND guest_id  = ${guestId}
    `

    if (!existing) {
      await sql`
        INSERT INTO votes (report_id, guest_id, vote_type)
        VALUES (${reportId}, ${guestId}, ${voteType})
      `
    } else if (existing.vote_type === voteType) {
      // Same vote → toggle off
      await sql`DELETE FROM votes WHERE id = ${existing.id}`
    } else {
      // Different vote → switch side
      await sql`UPDATE votes SET vote_type = ${voteType} WHERE id = ${existing.id}`
    }
  }

  async delete(id: number): Promise<void> {
    await sql`
      DELETE FROM reports 
      WHERE id = ${id}
    `
  }
  
  async flagReport(reportId: number): Promise<void> {
    await sql`UPDATE reports SET is_flagged = true WHERE id = ${reportId}`;
  }

}
