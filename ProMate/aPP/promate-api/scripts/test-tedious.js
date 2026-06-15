require('dotenv').config()
const { Connection } = require('tedious')

const config = {
  server: '10.1.69.13',
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
  },
  options: {
    port: parseInt(process.env.DB_HOST?.split(':')[1] || '50461'),
    database: process.env.DB_NAME,
    encrypt: false,
    trustServerCertificate: true,
  },
}

console.log('Łączę z:', config.server, 'port:', config.options.port)
console.log('Baza:', config.options.database, '| User:', config.authentication.options.userName)

const conn = new Connection(config)

conn.on('connect', (err) => {
  if (err) {
    console.error('❌ Błąd:', err.message)
  } else {
    console.log('✅ Połączono przez tedious!')
  }
  conn.close()
})

conn.connect()
