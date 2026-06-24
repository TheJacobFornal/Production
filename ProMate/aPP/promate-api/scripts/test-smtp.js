require('dotenv').config()
const nodemailer = require('nodemailer')

async function test() {
  console.log('SMTP config:', {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS ? '***' : '(pusta!)',
  })

  const transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false,
    tls:    { ciphers: 'SSLv3' },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  try {
    await transport.verify()
    console.log('✅ Połączenie SMTP OK — można wysyłać maile')
  } catch (err) {
    console.error('❌ Błąd SMTP:', err.message)
    console.error('   Kod:', err.code)
    console.error('   Response:', err.response)
  }
}

test()
