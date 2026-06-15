require('dotenv').config()
const { execSync } = require('child_process')

const host     = process.env.DB_HOST     || '10.1.69.13:50461'
const db       = process.env.DB_NAME     || 'worksheets_prod'
const user     = process.env.DB_USER     || 'ws'
const password = encodeURIComponent(process.env.DB_PASSWORD || '')

const url = `sqlserver://${host};database=${db};user=${user};password=${password};encrypt=false;trustServerCertificate=true`

console.log('Built URL (password hidden):')
console.log(url.replace(/password=[^;]+/, 'password=***'))

process.env.DATABASE_URL = url

execSync('npx prisma db push', { stdio: 'inherit', env: process.env })
