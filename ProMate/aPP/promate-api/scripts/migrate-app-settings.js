require('dotenv').config()
const sql = require('mssql')

const config = {
  server:   (process.env.DB_HOST || 'localhost:1433').split(':')[0],
  port:     parseInt((process.env.DB_HOST || 'localhost:1433').split(':')[1] || '1433'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: false, trustServerCertificate: true },
}

async function run() {
  const pool = await sql.connect(config)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='app_setting' AND xtype='U')
    CREATE TABLE [app_setting] (
      [key]   NVARCHAR(100) PRIMARY KEY,
      value NVARCHAR(500) NULL
    )
  `)
  // Domyślne wartości
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM [app_setting] WHERE [key]='printer')
      INSERT INTO [app_setting] ([key], value) VALUES ('printer', NULL)
    IF NOT EXISTS (SELECT 1 FROM [app_setting] WHERE [key]='print_karta')
      INSERT INTO [app_setting] ([key], value) VALUES ('print_karta', '1')
  `)
  console.log('✅ Tabela [app_setting] gotowa')
  await pool.close()
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })
