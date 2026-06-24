import { Router } from 'express'
import { getDb, sql } from '../config/database'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const db   = await getDb()
    const type = req.query.type as string | undefined
    const result = type
      ? await db.request()
          .input('type', sql.VarChar(50), type)
          .query('SELECT id, name, description FROM [phase] WHERE type = @type ORDER BY name')
      : await db.request()
          .query('SELECT id, name, description FROM [phase] ORDER BY name')
    res.json(result.recordset)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Błąd serwera'
    res.status(500).json({ error: msg })
  }
})

export default router
