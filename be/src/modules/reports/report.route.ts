import { Hono } from 'hono'
import { ReportRepository } from './report.repository'
import { ReportService } from './report.service'
import { ReportHandler } from './report.handler'
import { guestIdMiddleware } from '../../shared/middleware/guest-id'

const reportsRouter = new Hono()

const reportRepository = new ReportRepository()
const reportService = new ReportService(reportRepository)
const reportHandler = new ReportHandler(reportService)

reportsRouter.use('*', guestIdMiddleware())
reportsRouter.post('/:id/votes', reportHandler.vote)

reportsRouter.post('/', reportHandler.create)
reportsRouter.get('/', reportHandler.getAll)
reportsRouter.get('/:id', reportHandler.getById)
reportsRouter.delete('/:id', reportHandler.delete)

export default reportsRouter
