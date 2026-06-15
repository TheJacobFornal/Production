import { getDb, sql } from '../config/database'

class CommercialRepository {
  /** Tworzy form_log (jeśli brak) + rekord commercial dla danego detalu */
  async create(partId: number): Promise<void> {
    const db = await getDb()

    // 1. Upewnij się, że form_log istnieje
    await db.request()
      .input('partId', sql.Int, partId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM form_log WHERE part_id = @partId)
          INSERT INTO form_log (part_id) VALUES (@partId)
      `)

    // 2. Pobierz id form_log
    const fl = await db.request()
      .input('partId', sql.Int, partId)
      .query('SELECT id FROM form_log WHERE part_id = @partId')
    const formId: number = fl.recordset[0].id

    // 3. Wstaw commercial (jeśli jeszcze nie ma)
    await db.request()
      .input('formId', sql.Int, formId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM commercial WHERE form_id = @formId)
          INSERT INTO commercial (form_id) VALUES (@formId)
      `)
  }

  /** Usuwa commercial dla danego detalu */
  async deleteByPartId(partId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId', sql.Int, partId)
      .query(`
        DELETE c
        FROM   commercial c
        JOIN   form_log   fl ON fl.id = c.form_id
        WHERE  fl.part_id = @partId
      `)
  }

  /** Zwraca listę part_id, dla których istnieje rekord commercial */
  async getCheckedPartIds(partIds: number[]): Promise<number[]> {
    if (!partIds.length) return []
    const db = await getDb()
    const result = await db.request().query(`
      SELECT fl.part_id
      FROM   commercial c
      JOIN   form_log   fl ON fl.id = c.form_id
      WHERE  fl.part_id IN (${partIds.join(',')})
    `)
    return result.recordset.map((r: { part_id: number }) => r.part_id)
  }
}

export const commercialRepository = new CommercialRepository()
