import sql from 'mssql'

let pool: sql.ConnectionPool | null = null

// Config budowany lazily — czyta process.env dopiero przy pierwszym połączeniu
function getConfig(): sql.config {
  return {
    server: (process.env.DB_HOST ?? 'localhost:1433').split(':')[0],
    port: parseInt((process.env.DB_HOST ?? 'localhost:1433').split(':')[1] ?? '1433'),
    database: process.env.DB_NAME ?? 'promate_test',
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  }
}

export async function getDb(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(getConfig())
  }
  return pool
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close()
    pool = null
  }
}

export { sql }
