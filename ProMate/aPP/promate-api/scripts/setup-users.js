/**
 * Tworzy tabele [position] i [user], dodaje domyslne stanowiska
 * oraz uzytkowanika FornalJ jako administratora.
 * Uruchom: node scripts/setup-users.js
 */
require('dotenv').config()
const sql    = require('mssql')
const bcrypt = require('bcrypt')

const config = {
  server:   (process.env.DB_HOST || '10.1.69.13:50461').split(':')[0],
  port:     parseInt((process.env.DB_HOST || '10.1.69.13:50461').split(':')[1] || '50461'),
  database: process.env.DB_NAME     || 'worksheets_prod',
  user:     process.env.DB_USER     || 'ws',
  password: process.env.DB_PASSWORD || '',
  options:  { encrypt: false, trustServerCertificate: true },
}

async function run() {
  const pool = await sql.connect(config)
  console.log('✅ Połączono z bazą:', config.database)

  // 1. Tabela [position]
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='position' AND xtype='U')
    CREATE TABLE [position] (
      id   INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(100) NOT NULL
    )
  `)
  console.log('✔ Tabela [position] gotowa')

  // 2. Tabela [user]
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user' AND xtype='U')
    CREATE TABLE [user] (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      name          NVARCHAR(100) NOT NULL,
      surname       NVARCHAR(100) NOT NULL,
      email         NVARCHAR(255) NULL,
      position_id   INT           NULL REFERENCES [position](id),
      is_active     BIT           NOT NULL DEFAULT 1,
      password_hash NVARCHAR(255) NULL,
      is_admin      BIT           NOT NULL DEFAULT 0,
      created_at    DATETIME2     NOT NULL DEFAULT GETDATE()
    )
  `)
  console.log('✔ Tabela [user] gotowa')

  // 3. Kolumny password_hash i is_admin (jezeli tabela juz istniala)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('[user]') AND name='password_hash')
      ALTER TABLE [user] ADD password_hash NVARCHAR(255) NULL
  `)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('[user]') AND name='is_admin')
      ALTER TABLE [user] ADD is_admin BIT NOT NULL DEFAULT 0
  `)
  console.log('✔ Kolumny password_hash i is_admin gotowe')

  // 4. Domyslne stanowiska
  const posCount = await pool.request().query('SELECT COUNT(*) AS cnt FROM [position]')
  if (posCount.recordset[0].cnt === 0) {
    await pool.request().query(`
      INSERT INTO [position] (name) VALUES
        ('Operator CNC'), ('Technolog'), ('Kierownik produkcji'), ('Administrator')
    `)
    console.log('✔ Domyślne stanowiska dodane')
  } else {
    console.log('✔ Stanowiska już istnieją — pominięto')
  }

  // 5. Uzytkownik FornalJ
  const hash = await bcrypt.hash('Pemes1234', 12)

  const posRes = await pool.request()
    .query("SELECT id FROM [position] WHERE name = 'Administrator'")
  const posId = posRes.recordset[0]?.id ?? null

  const existing = await pool.request()
    .query("SELECT id FROM [user] WHERE LOWER(surname + LEFT(name,1)) = 'fornalj'")

  if (existing.recordset.length > 0) {
    const id = existing.recordset[0].id
    await pool.request()
      .input('id',   sql.Int,          id)
      .input('hash', sql.NVarChar(255), hash)
      .query('UPDATE [user] SET password_hash=@hash, is_admin=1, is_active=1 WHERE id=@id')
    console.log(`✔ Zaktualizowano FornalJ (id=${id}) — hasło i admin ustawione`)
  } else {
    const ins = await pool.request()
      .input('name',        sql.NVarChar(100), 'Jakub')
      .input('surname',     sql.NVarChar(100), 'Fornal')
      .input('email',       sql.NVarChar(255), 'fornal.chat@gmail.com')
      .input('position_id', sql.Int,            posId)
      .input('hash',        sql.NVarChar(255),  hash)
      .query(`
        INSERT INTO [user] (name, surname, email, position_id, password_hash, is_admin)
        OUTPUT INSERTED.id
        VALUES (@name, @surname, @email, @position_id, @hash, 1)
      `)
    console.log(`✔ Utworzono FornalJ (id=${ins.recordset[0].id}) — Administrator`)
  }

  await pool.close()
  console.log('\n✅ Gotowe! Zaloguj się: login=FornalJ, hasło=Pemes1234')
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
