/**
 * Tworzy lub aktualizuje użytkownika FornalJ jako administratora.
 * Uruchom: node scripts/seed-admin.js
 */
require('dotenv').config()
const sql    = require('mssql')
const bcrypt = require('bcrypt')

const config = {
  server:   process.env.DB_SERVER   || 'localhost',
  database: process.env.DB_NAME     || 'worksheets_prod',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: false, trustServerCertificate: true },
  port:     Number(process.env.DB_PORT) || 1433,
}

async function main() {
  const pool = await sql.connect(config)

  const hash = await bcrypt.hash('Pemes1234', 12)

  // Sprawdz czy user istnieje
  const existing = await pool.request()
    .input('surname', sql.NVarChar, 'Fornal')
    .input('name',    sql.NVarChar, 'Jakub')
    .query("SELECT id FROM [user] WHERE surname = @surname AND LEFT(name,1) = 'J'")

  if (existing.recordset.length > 0) {
    const id = existing.recordset[0].id
    await pool.request()
      .input('id',   sql.Int,         id)
      .input('hash', sql.NVarChar(255), hash)
      .query("UPDATE [user] SET password_hash = @hash, is_admin = 1 WHERE id = @id")
    console.log(`✓ Zaktualizowano użytkownika FornalJ (id=${id}) — hasło i flaga admin ustawione.`)
  } else {
    // Pobierz id stanowiska Administrator
    const posRes = await pool.request()
      .query("SELECT id FROM [position] WHERE name = 'Administrator'")
    const posId = posRes.recordset[0]?.id ?? null

    const ins = await pool.request()
      .input('name',        sql.NVarChar(100),  'Jakub')
      .input('surname',     sql.NVarChar(100),  'Fornal')
      .input('email',       sql.NVarChar(255),  'fornal.chat@gmail.com')
      .input('position_id', sql.Int,             posId)
      .input('hash',        sql.NVarChar(255),   hash)
      .query(`
        INSERT INTO [user] (name, surname, email, position_id, password_hash, is_admin)
        OUTPUT INSERTED.id
        VALUES (@name, @surname, @email, @position_id, @hash, 1)
      `)
    console.log(`✓ Utworzono użytkownika FornalJ (id=${ins.recordset[0].id}) z hasłem i uprawnieniami admina.`)
  }

  await pool.close()
}

main().catch(e => { console.error(e); process.exit(1) })
