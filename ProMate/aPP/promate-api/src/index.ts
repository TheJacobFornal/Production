import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import { createApp } from './app'
import { getDb } from './config/database'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runMigrations } = require('../scripts/migrate-auto')

const app = createApp()
const PORT = process.env.PORT ?? 5000
const ENV = process.env.NODE_ENV ?? 'development'

async function start() {
  const pool = await getDb()
  await runMigrations(pool)

  app.listen(PORT, () => {
    console.log(`\n🚀 ProMate API na porcie ${PORT} [${ENV.toUpperCase()}]`)
    console.log(`📦 Baza: ${process.env.DB_NAME} @ ${process.env.DB_HOST}\n`)
  })
}

start().catch(err => {
  console.error('❌ Błąd startu:', err.message)
  process.exit(1)
})
