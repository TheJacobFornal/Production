// Auto-migracje przy starcie serwera.
// Uruchamia tylko te pliki z migrations/ które nie były jeszcze zastosowane.
// Śledzi je w tabeli _migrations w bazie.

const sql  = require('mssql')
const fs   = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

async function runMigrations(pool) {
  // Utwórz tabelę śledzącą jeśli nie istnieje
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '_migrations')
    CREATE TABLE _migrations (
      name       NVARCHAR(255) PRIMARY KEY,
      applied_at DATETIME DEFAULT GETDATE()
    )
  `)

  // Pobierz już zastosowane migracje
  const { recordset } = await pool.request().query(`SELECT name FROM _migrations`)
  const applied = new Set(recordset.map(r => r.name))

  // Wczytaj pliki .sql posortowane
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      continue  // już zastosowana
    }

    console.log(`[migrate] Uruchamiam: ${file}`)
    const script = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')

    const statements = script
      .split(/^\s*GO\s*$/im)
      .map(s => s.replace(/--[^\n]*/g, '').trim())
      .filter(Boolean)

    for (const stmt of statements) {
      await pool.request().query(stmt)
    }

    // Oznacz jako zastosowaną
    await pool.request()
      .input('name', sql.NVarChar, file)
      .query(`INSERT INTO _migrations (name) VALUES (@name)`)

    console.log(`[migrate] ✅ ${file}`)
  }
}

module.exports = { runMigrations }
