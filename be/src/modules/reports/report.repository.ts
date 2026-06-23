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
      WHERE id = ${id}
    `
    return report || null
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
