import { ReportRepository, Report } from './report.repository'
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/utils/errors'
import { z } from 'zod'
import { AiModerationService } from '../../shared/services/ai-moderation.service'
import { env } from '../../config/env'
import { moderationBroadcaster } from '../../shared/services/moderation-broadcaster.service'

export const createReportSchema = z.object({
  reporter_name: z.string()
    .trim()
    .max(100, { message: 'Nama pelapor maksimal 100 karakter' })
    .optional()
    .nullable(),
  latitude: z.number({ message: 'Latitude wajib diisi' })
    .min(-90, { message: 'Latitude harus antara -90 dan 90 derajat' })
    .max(90, { message: 'Latitude harus antara -90 dan 90 derajat' }),
  longitude: z.number({ message: 'Longitude wajib diisi' })
    .min(-180, { message: 'Longitude harus antara -180 dan 180 derajat' })
    .max(180, { message: 'Longitude harus antara -180 dan 180 derajat' }),
  description: z.string()
    .trim()
    .max(1000, { message: 'Deskripsi maksimal 1000 karakter' })
    .optional()
    .nullable(),
  started_at: z.string()
    .datetime({ message: 'started_at harus berupa format ISO 8601' })
    .optional()
    .nullable(),
  ended_at: z.string()
    .datetime({ message: 'ended_at harus berupa format ISO 8601' })
    .optional()
    .nullable(),
})

export const getReportsQuerySchema = z.object({
  minLng: z.preprocess((val) => (val === '' || val === undefined ? undefined : val), z.coerce.number().min(-180).max(180)).optional(),
  minLat: z.preprocess((val) => (val === '' || val === undefined ? undefined : val), z.coerce.number().min(-90).max(90)).optional(),
  maxLng: z.preprocess((val) => (val === '' || val === undefined ? undefined : val), z.coerce.number().min(-180).max(180)).optional(),
  maxLat: z.preprocess((val) => (val === '' || val === undefined ? undefined : val), z.coerce.number().min(-90).max(90)).optional(),
}).refine(
  (data) => {
    const values = [data.minLng, data.minLat, data.maxLng, data.maxLat]
    const count = values.filter((v) => v !== undefined).length
    return count === 0 || count === 4
  },
  {
    message: 'Semua parameter bbox (minLng, minLat, maxLng, maxLat) harus diisi jika salah satu diisi.',
    path: ['minLng']
  }
)

export class ReportService {
  private readonly aiModerationService: AiModerationService

  constructor(private reportRepository: ReportRepository) {
    this.aiModerationService = new AiModerationService(env.AI_API_KEY)
  }

  async createReport(guestId: string, data: unknown): Promise<Report> {
    const validated = createReportSchema.parse(data)

    const report = await this.reportRepository.create({
      ...validated,
      guest_id: guestId,
    })
    
    const hasReporter = (report.reporter_name?.trim()?.length ?? 0) > 0;
    const hasDescription = (report.description?.trim()?.length ?? 0) > 0;
    if (hasReporter || hasDescription) {
      this.runBackgroundModeration(Number(report.id), {
        reporter_name: validated.reporter_name ?? null,
        description: validated.description ?? null
      });
    }
    
    const now = new Date()
    return {
      ...report,
      status: new Date(report.started_at) < now ? 'history' : 'schedule'
    }
  }

  private async runBackgroundModeration(
    reportId: number,
    input: { reporter_name: string | null; description: string | null }
  ): Promise<void> {
    const reportText = `${input.reporter_name || 'Anonim'}: ${input.description || 'Tidak ada deskripsi'}`
    try {
      const result = await this.aiModerationService.moderate(input)
      if (!result.is_safe) {
        await this.reportRepository.flagReport(reportId)
      }

      moderationBroadcaster.broadcast({
        type: 'moderation_result',
        report_data: String(reportText),
        is_flagged: !result.is_safe,
        reason: result.reason,
      })
    } catch (e) {
      console.error('Moderation error', e)
      moderationBroadcaster.broadcast({
        type: 'moderation_result',
        report_data: String(reportText),
        is_flagged: false,
        reason: 'Validasi gagal',
      })
    }
  }

  async getAllReports(query: unknown): Promise<Report[]> {
    const validated = getReportsQuerySchema.parse(query)
    const reports = await this.reportRepository.findAll(validated)
    const now = new Date()
    return reports.map(report => ({
      ...report,
      status: new Date(report.started_at) < now ? 'history' : 'schedule'
    }))
  }

  async deleteReport(id: number, guestId: string): Promise<void> {
    if (isNaN(id)) {
      throw new BadRequestError('ID report harus berupa angka valid.')
    }
    
    const report = await this.reportRepository.findById(id)

    if (!report) {
      throw new NotFoundError('Report tidak ditemukan.')
    }

    if (report.guest_id !== guestId) {
      throw new ForbiddenError('Anda tidak memiliki akses untuk menghapus report ini.')
    }

    await this.reportRepository.delete(id)
  }
}
