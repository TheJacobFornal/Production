import dotenv from 'dotenv'
dotenv.config()

import { createApp } from './app'

const app = createApp()
const PORT = process.env.PORT ?? 5000
const ENV = process.env.NODE_ENV ?? 'development'

app.listen(PORT, () => {
  console.log(`\n🚀 ProMate API na porcie ${PORT} [${ENV.toUpperCase()}]`)
  console.log(`📦 Baza: ${process.env.DB_NAME} @ ${process.env.DB_HOST}\n`)
})
