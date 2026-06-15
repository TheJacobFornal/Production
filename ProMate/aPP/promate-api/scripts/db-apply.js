require('dotenv').config()
const sql = require('mssql')
const fs = require('fs')
const path = require('path')

const config = {
  server: (process.env.DB_HOST || '10.1.69.13:50461').split(':')[0],
  port: parseInt((process.env.DB_HOST || '10.1.69.13:50461').split(':')[1] || '50461'),
  database: process.env.DB_NAME || 'worksheets_prod',
  user: process.env.DB_USER || 'ws',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true },
}

async function run() {
  const pool = await sql.connect(config)
  console.log('✅ Połączono z bazą')

  const sqlFile = path.resolve(__dirname, '../../../ProMate_db_3.sql')
  const script = fs.readFileSync(sqlFile, 'utf8')

  // Podziel na pojedyncze instrukcje po GO (separator MS SQL)
  const statements = script
    .split(/^\s*GO\s*$/im)
    .map(s => s.trim())
    .filter(Boolean)

  for (const stmt of statements) {
    try {
      await pool.request().query(stmt)
      console.log('✔', stmt.substring(0, 60).replace(/\n/g, ' '))
    } catch (err) {
      console.warn('⚠ Pominięto (może już istnieje):', err.message.substring(0, 80))
    }
  }

  await pool.close()
  console.log('\n✅ Schemat zastosowany.')
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
