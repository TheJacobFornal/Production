import { getDb, sql } from '../config/database'

export interface PartSearchResult {
  id:           number
  part_number:  string
  name:         string
  order_number: string
}

export interface PartWithOrder {
  id:                    number
  order_id:              number
  symbol:                string | null
  part_number:           string
  name:                  string
  quantity_right:        number
  quantity_left:         number
  phase_id:              number | null
  location_id:           number | null
  card_printed:          boolean
  sticker_printed:       boolean
  barcode:               string | null
  finished_at:           string | null
  rework_parent_part_id: number | null
  order_number:          string
}

class PartsRepository {
  async getById(partId: number): Promise<PartWithOrder | null> {
    const db = await getDb()
    const result = await db.request()
      .input('id', sql.Int, partId)
      .query(`
        SELECT p.id, p.order_id, p.symbol, p.part_number, p.name,
               p.quantity_right, p.quantity_left, p.phase_id, p.location_id,
               p.card_printed, p.sticker_printed, p.barcode, p.finished_at,
               p.rework_parent_part_id,
               o.order_number
        FROM   [part]  p
        JOIN   [order] o ON o.id = p.order_id
        WHERE  p.id = @id
      `)
    return result.recordset[0] ?? null
  }

  /** Szuka detali po fragmencie numeru detalu */
  async searchByNumber(q: string): Promise<PartSearchResult[]> {
    const db = await getDb()
    const result = await db.request()
      .input('q', sql.NVarChar, `%${q}%`)
      .query(`
        SELECT TOP 50
          p.id,
          p.part_number,
          p.name,
          o.order_number
        FROM   [part]  p
        JOIN   [order] o ON o.id = p.order_id
        WHERE  p.part_number LIKE @q
        ORDER  BY o.order_number, p.part_number
      `)
    return result.recordset as PartSearchResult[]
  }

  /** Aktualizuje fazę detalu */
  async updatePhase(partId: number, phaseId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',  sql.Int, partId)
      .input('phaseId', sql.Int, phaseId)
      .query('UPDATE [part] SET phase_id = @phaseId WHERE id = @partId')
  }

  /** Ustawia rework_parent_part_id dla detalu */
  async setRework(partId: number, parentPartId: number | null): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',       sql.Int, partId)
      .input('parentPartId', sql.Int, parentPartId)
      .query(`
        UPDATE [part]
        SET    rework_parent_part_id = @parentPartId
        WHERE  id = @partId
      `)
  }
}

export const partsRepository = new PartsRepository()
