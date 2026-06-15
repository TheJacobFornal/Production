import dotenv from 'dotenv'
import path from 'path'

// Ładuj .env.test przed każdym plikiem testowym
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })
