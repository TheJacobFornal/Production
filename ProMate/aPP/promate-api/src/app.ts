import express from 'express'
import cors from 'cors'
import path from 'path'
import authRoutes from './routes/auth.routes'
import usersRoutes from './routes/users.routes'
import settingsRoutes from './routes/settings.routes'
import ordersRoutes from './routes/orders.routes'
import operationLogsRoutes from './routes/operation-logs.routes'
import formLogRoutes from './routes/form-log.routes'
import cooperationRoutes from './routes/cooperation.routes'
import cooperationLogRoutes from './routes/cooperation-log.routes'
import commercialRoutes from './routes/commercial.routes'
import partsRoutes from './routes/parts.routes'
import operationsRoutes from './routes/operations.routes'
import materialsRoutes from './routes/materials.routes'
import priceRoutes from './routes/price.routes'
import phasesRoutes from './routes/phases.routes'
import printersRoutes from './routes/printers.routes'
import fileRoutes   from './routes/file.routes'
import dialogRoutes from './routes/dialog.routes'

export function createApp() {
  const app = express()

  app.use(cors({ origin: process.env.CLIENT_URL }))
  app.use(express.json())

  app.use('/api/auth', authRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/settings', settingsRoutes)
  app.use('/api/orders', ordersRoutes)
  app.use('/api/operation-logs', operationLogsRoutes)
  app.use('/api/form-log', formLogRoutes)
  app.use('/api/cooperations', cooperationRoutes)
  app.use('/api/cooperation-log', cooperationLogRoutes)
  app.use('/api/commercial', commercialRoutes)
  app.use('/api/parts', partsRoutes)
  app.use('/api/operations', operationsRoutes)
  app.use('/api/materials', materialsRoutes)
  app.use('/api/price', priceRoutes)
  app.use('/api/phases', phasesRoutes)
  app.use('/api/printers', printersRoutes)
  app.use('/api/file',   fileRoutes)
  app.use('/api/dialog', dialogRoutes)

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      env: process.env.NODE_ENV ?? 'development',
      db: process.env.DB_NAME ?? 'unknown',
    })
  })

  // Serwuj zbudowany frontend
  const clientDist = path.join(__dirname, '../../promate-client/dist')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })

  return app
}
