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
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('[user]') AND name='reset_token')
      ALTER TABLE [user] ADD reset_token NVARCHAR(255) NULL
  `)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('[user]') AND name='reset_token_expires')
      ALTER TABLE [user] ADD reset_token_expires DATETIME2 NULL
  `)
  console.log('✅ Kolumny reset_token i reset_token_expires dodane')
  await pool.close()
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })
