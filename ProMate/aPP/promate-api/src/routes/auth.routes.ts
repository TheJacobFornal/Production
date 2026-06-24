import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { getDb, sql } from '../config/database'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  const { login, password } = req.body
  if (!login || typeof login !== 'string') {
    return res.status(400).json({ error: 'Login jest wymagany' })
  }

  try {
    const db = await getDb()
    const result = await db.request()
      .input('login', sql.NVarChar(150), login.trim())
      .query(`
        SELECT u.id, u.name, u.surname, u.email,
               pos.name  AS position_name,
               u.password_hash,
               u.is_admin
        FROM [user] u
        LEFT JOIN [position] pos ON pos.id = u.position_id
        WHERE LOWER(u.surname + LEFT(u.name, 1)) = LOWER(@login)
          AND u.is_active = 1
      `)

    const user = result.recordset[0]
    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' })
    }

    // Jeśli użytkownik ma ustawione hasło — weryfikuj je
    if (user.password_hash) {
      if (!password) {
        return res.status(401).json({ error: 'Podaj hasło' })
      }
      const ok = await bcrypt.compare(String(password), user.password_hash)
      if (!ok) {
        return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' })
      }
    }

    return res.json({
      id:            user.id,
      name:          user.name,
      surname:       user.surname,
      email:         user.email         ?? null,
      position_name: user.position_name ?? null,
      is_admin:      Boolean(user.is_admin),
    })
  } catch (err) {
    console.error('[auth/login]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── Generowanie linku resetowania hasła (bez wysyłania emaila) ──────────────

router.post('/request-reset', async (req: Request, res: Response) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'Brak userId' })

  try {
    const db = await getDb()
    const userRes = await db.request()
      .input('id', sql.Int, Number(userId))
      .query('SELECT id, name, surname FROM [user] WHERE id = @id AND is_active = 1')

    const user = userRes.recordset[0]
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })

    const token   = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 godziny

    await db.request()
      .input('id',      sql.Int,          user.id)
      .input('token',   sql.NVarChar(255), token)
      .input('expires', sql.DateTime2,     expires)
      .query('UPDATE [user] SET reset_token=@token, reset_token_expires=@expires WHERE id=@id')

    const appUrl   = process.env.APP_URL || 'http://localhost:5173'
    const resetUrl = `${appUrl}/reset-hasla?token=${token}`

    return res.json({ url: resetUrl })
  } catch (err) {
    console.error('[auth/request-reset]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── Informacje o użytkowniku na podstawie tokenu ────────────────────────────

router.get('/reset-info', async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '')
  if (!token) return res.status(400).json({ error: 'Brak tokenu' })

  try {
    const db = await getDb()
    const result = await db.request()
      .input('token', sql.NVarChar(255), token)
      .query(`
        SELECT name, surname FROM [user]
        WHERE reset_token = @token
          AND reset_token_expires > GETDATE()
          AND is_active = 1
      `)
    const user = result.recordset[0]
    if (!user) return res.status(400).json({ error: 'Link wygasł lub jest nieprawidłowy' })
    return res.json({ name: user.name, surname: user.surname })
  } catch (err) {
    console.error('[auth/reset-info]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── Resetowanie hasła na podstawie tokenu ────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Brak tokenu lub hasła' })
  if (String(password).length < 6) return res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków' })

  try {
    const db = await getDb()
    const userRes = await db.request()
      .input('token', sql.NVarChar(255), token)
      .query(`
        SELECT id FROM [user]
        WHERE reset_token = @token
          AND reset_token_expires > GETDATE()
          AND is_active = 1
      `)

    const user = userRes.recordset[0]
    if (!user) return res.status(400).json({ error: 'Link wygasł lub jest nieprawidłowy' })

    const hash = await bcrypt.hash(String(password), 12)

    await db.request()
      .input('id',   sql.Int,          user.id)
      .input('hash', sql.NVarChar(255), hash)
      .query('UPDATE [user] SET password_hash=@hash, reset_token=NULL, reset_token_expires=NULL WHERE id=@id')

    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/reset-password]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
