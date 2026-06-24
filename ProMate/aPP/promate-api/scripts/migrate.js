// Uruchamianie migracji SQL na wybranej bazie
// Użycie:
//   node scripts/migrate.js migrations/001_update_phases.sql --env test
//   node scripts/migrate.js migrations/001_update_phases.sql --env prod

const path = require('path')
const args    = process.argv.slice(2)
const sqlFile = args.find(a => !a.startsWith('--'))
const env     = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'test'

const envFile = env === 'prod' ? '.env.production' : '.env.test'
require('dotenv').config({ path: path.join(__dirname, '..', envFile) })

const sql = require('mssql')
const fs  = require('fs')

if (!sqlFile) {
  console.error('Podaj plik SQL: node scripts/migrate.js migrations/XXX.sql --env test|prod')
  process.exit(1)
}

const config = {
  server:   (process.env.DB_HOST || 'localhost:1433').split(':')[0],
  port:     parseInt((process.env.DB_HOST || 'localhost:1433').split(':')[1] || '1433'),
  database: process.env.DB_NAME || 'promate_test',
  user:     process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options:  { encrypt: false, trustServerCertificate: true },
}

async function run() {
  console.log(`\n🗄  Baza: ${config.database} (${env})`)
  console.log(`📄 Plik: ${sqlFile}\n`)

  if (env === 'prod') {
    console.log('⚠️  UWAGA: Uruchamiasz na bazie PRODUKCYJNEJ!')
    console.log('   Masz 5 sekund na Ctrl+C żeby anulować...\n')
    await new Promise(r => setTimeout(r, 5000))
  }

  const pool = await sql.connect(config)
  console.log('✅ Połączono\n')

  const filePath = path.resolve(__dirname, sqlFile)
  const script   = fs.readFileSync(filePath, 'utf8')

  // Pomiń komentarze blokowe i podziel po GO
  const statements = script
    .split(/^\s*GO\s*$/im)
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean)

  let ok = 0, fail = 0
  for (const stmt of statements) {
    try {
      const result = await pool.request().query(stmt)
      const rows   = result.recordset
      if (rows?.length) {
        console.table(rows)
      } else {
        console.log('✔', stmt.substring(0, 80).replace(/\n/g, ' '))
      }
      ok++
    } catch (err) {
      console.error('❌ BŁĄD:', err.message)
      console.error('   Instrukcja:', stmt.substring(0, 120).replace(/\n/g, ' '))
      fail++
      // Zatrzymaj migrację przy błędzie
      break
    }
  }

  await pool.close()
  console.log(`\n${ fail ? '❌' : '✅' } Gotowe: ${ok} OK, ${fail} błędów`)
  if (fail) process.exit(1)
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
