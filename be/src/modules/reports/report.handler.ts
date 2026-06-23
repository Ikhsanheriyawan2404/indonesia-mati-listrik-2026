import type { Context } from 'hono'
import type { ReportService } from './report.service'

export class ReportHandler {
  constructor(private reportService: ReportService) {}

  create = async (c: Context) => {
    const guestId = c.get('guestId') as string
    const body = await c.req.json()
    
    const report = await this.reportService.createReport(guestId, body)
    
    return c.json({
      message: 'Report berhasil dibuat',
      data: report
    }, 201)
  }

  getAll = async (c: Context) => {
    const query = c.req.query();
    const reports = await this.reportService.getAllReports(query);
    return c.json({
      message: 'Report berhasil diambil',
      data: reports
    });
  }

  delete = async (c: Context) => {
    const guestId = c.get('guestId') as string
    const id = Number(c.req.param('id'))
    
    await this.reportService.deleteReport(id, guestId)
    
    return c.json({
      message: 'Report berhasil dihapus.'
    })
  }
}
