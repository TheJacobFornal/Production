import express from 'express'
import cors from 'cors'
import path from 'path'
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

export function createApp() {
  const app = express()

  app.use(cors({ origin: process.env.CLIENT_URL }))
  app.use(express.json())

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

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      env: process.env.NODE_ENV ?? 'development',
      db: process.env.DB_NAME ?? 'unknown',
    })
  })

  // Serwuj zbudowany frontend (tylko w trybie produkcyjnym)
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../../promate-client/dist')
    app.use(express.static(clientDist))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

  return app
}
