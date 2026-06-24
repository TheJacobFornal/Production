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

  /** Zwraca wszystkie detale z flagą commercial wraz z danymi zamówienia */
  async getAllParts() {
    const db = await getDb()
    const result = await db.request().query(`
      SELECT
        c.id             AS commercial_id,
        fl.part_id,
        o.order_number   AS numer_zlecenia,
        p.part_number    AS nr_detalu,
        p.quantity_right AS ilosc,
        c.ordered_at     AS data_zamowienia,
        c.arrived_at     AS data_dostawy,
        CASE
          WHEN c.arrived_at IS NOT NULL THEN 2
          WHEN c.ordered_at IS NOT NULL THEN 1
          ELSE 0
        END              AS status_num
      FROM  [commercial] c
      JOIN  [form_log]   fl ON fl.id = c.form_id
      JOIN  [part]       p  ON p.id  = fl.part_id
      JOIN  [order]      o  ON o.id  = p.order_id
      ORDER BY o.order_number, p.part_number
    `)
    return result.recordset
  }

  /** Aktualizuje status (ordered_at / arrived_at) rekordu commercial */
  async updateStatus(commercialId: number, status: 'Do zamówienia' | 'Zamówione' | 'Dotarło'): Promise<void> {
    const db = await getDb()
    const req = db.request().input('id', sql.Int, commercialId)
    if (status === 'Do zamówienia') {
      await req.query(`UPDATE [commercial] SET ordered_at = NULL, arrived_at = NULL WHERE id = @id`)
    } else if (status === 'Zamówione') {
      await req.query(`UPDATE [commercial] SET ordered_at = GETDATE(), arrived_at = NULL WHERE id = @id`)
    } else {
      await req.query(`UPDATE [commercial] SET arrived_at = GETDATE() WHERE id = @id`)
    }
  }

  /** Aktualizuje daty ręcznie wpisane przez użytkownika */
  async updateDates(commercialId: number, orderedAt: string | null, arrivedAt: string | null): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('id',         sql.Int,      commercialId)
      .input('orderedAt',  sql.DateTime, orderedAt ? new Date(orderedAt) : null)
      .input('arrivedAt',  sql.DateTime, arrivedAt ? new Date(arrivedAt) : null)
      .query(`
        UPDATE [commercial]
        SET ordered_at = @orderedAt,
            arrived_at = @arrivedAt
        WHERE id = @id
      `)
  }
}

export const commercialRepository = new CommercialRepository()
