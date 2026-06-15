require('dotenv').config()

const url = process.env.DATABASE_URL
console.log('\nFull URL:')
console.log(url)

const parts = url.split(';')
console.log('\nParsed parts:')
for (const part of parts) {
  if (part.startsWith('password=')) {
    const pwd = part.substring(9)
    console.log('password =', JSON.stringify(pwd))
    console.log('password length =', pwd.length)
  } else {
    console.log(part)
  }
}
