import { Router, Request, Response } from 'express'
import { getDb, sql } from '../config/database'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db  = await getDb()
    const rows = (await db.request().query('SELECT [key], value FROM [app_setting]')).recordset
    const map: Record<string, string | null> = {}
    for (const r of rows) map[r.key] = r.value
    res.json({
      printer:    map['printer']    ?? null,
      print_karta: map['print_karta'] === '0' ? false : true,
    })
  } catch (err) {
    console.error('[settings GET]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/', async (req: Request, res: Response) => {
  const { printer, print_karta } = req.body
  try {
    const db = await getDb()
    if (printer !== undefined) {
      await db.request()
        .input('v', sql.NVarChar(500), printer || null)
        .query(`
          IF EXISTS (SELECT 1 FROM [app_setting] WHERE [key]='printer')
            UPDATE [app_setting] SET value=@v WHERE [key]='printer'
          ELSE
            INSERT INTO [app_setting] ([key],value) VALUES ('printer',@v)
        `)
    }
    if (print_karta !== undefined) {
      const v = print_karta ? '1' : '0'
      await db.request()
        .input('v', sql.NVarChar(500), v)
        .query(`
          IF EXISTS (SELECT 1 FROM [app_setting] WHERE [key]='print_karta')
            UPDATE [app_setting] SET value=@v WHERE [key]='print_karta'
          ELSE
            INSERT INTO [app_setting] ([key],value) VALUES ('print_karta',@v)
        `)
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings PATCH]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
