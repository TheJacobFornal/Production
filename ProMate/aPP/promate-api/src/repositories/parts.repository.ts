import { getDb, sql } from '../config/database'
import { syncOrderPhase } from './order-phase.helper'

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
  deadline_at:           string | null
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
               p.rework_parent_part_id, p.deadline_at,
               o.order_number,
               ph.name AS phase_name
        FROM   [part]  p
        JOIN   [order] o ON o.id = p.order_id
        LEFT JOIN [phase] ph ON ph.id = p.phase_id
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
    await syncOrderPhase(partId)
  }

  async getPathsByPartIds(partIds: number[]): Promise<{ part_id: number; PDF_path: string | null; DWG_path: string | null; STP_path: string | null }[]> {
    if (!partIds.length) return []
    const db = await getDb()
    const result = await db.request()
      .query(`SELECT part_id, PDF_path, DWG_path, STP_path FROM [paths] WHERE part_id IN (${partIds.join(',')})`)
    return result.recordset
  }

  async getPdfPath(partId: number): Promise<string | null> {
    const db = await getDb()
    const result = await db.request()
      .input('id', sql.Int, partId)
      .query('SELECT PDF_path FROM [paths] WHERE part_id = @id')
    return result.recordset[0]?.PDF_path ?? null
  }

  async getPartsByOrderId(orderId: number): Promise<PartWithOrder[]> {
    const db = await getDb()
    const result = await db.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT p.*, o.order_number
        FROM   [part]  p
        JOIN   [order] o ON o.id = p.order_id
        WHERE  p.order_id = @orderId
        ORDER BY p.part_number
      `)
    return result.recordset as PartWithOrder[]
  }

  async createSubPart(data: {
    orderId:       number
    partNumber:    string
    name:          string
    symbol:        string | null
    quantityRight: number
    quantityLeft:  number
    deadlineAt:    string | Date | null
    linId:         number | null
    compoundId:    number | null
    pdfPath:       string | null
    dwgPath:       string | null
    stpPath:       string | null
  }): Promise<number> {
    const db = await getDb()

    const partResult = await db.request()
      .input('orderId',       sql.Int,           data.orderId)
      .input('partNumber',    sql.NVarChar(100),  data.partNumber)
      .input('name',          sql.NVarChar(200),  data.name)
      .input('symbol',        sql.NVarChar(100),  data.symbol)
      .input('quantityRight', sql.Int,            data.quantityRight)
      .input('quantityLeft',  sql.Int,            data.quantityLeft)
      .input('deadlineAt',    sql.DateTime,       data.deadlineAt ? new Date(data.deadlineAt as string) : null)
      .input('linId',         sql.Int,            data.linId)
      .input('compoundId',    sql.Int,            data.compoundId)
      .query(`
        INSERT INTO [part]
          (order_id, part_number, name, symbol, quantity_right, quantity_left,
           deadline_at, LinId, card_printed, sticker_printed, compound_id)
        OUTPUT INSERTED.id
        VALUES
          (@orderId, @partNumber, @name, @symbol, @quantityRight, @quantityLeft,
           @deadlineAt, @linId, 0, 0, @compoundId)
      `)
    const partId: number = partResult.recordset[0].id

    const pathsResult = await db.request()
      .input('partId',  sql.Int,           partId)
      .input('pdfPath', sql.NVarChar(500),  data.pdfPath)
      .input('dwgPath', sql.NVarChar(500),  data.dwgPath)
      .input('stpPath', sql.NVarChar(500),  data.stpPath)
      .query(`
        INSERT INTO [paths] (part_id, PDF_path, DWG_path, STP_path)
        OUTPUT INSERTED.id
        VALUES (@partId, @pdfPath, @dwgPath, @stpPath)
      `)
    const pathsId: number = pathsResult.recordset[0].id

    await db.request()
      .input('pathsId', sql.Int, pathsId)
      .input('partId',  sql.Int, partId)
      .query(`UPDATE [part] SET paths_id = @pathsId WHERE id = @partId`)

    await db.request()
      .input('partId', sql.Int, partId)
      .query(`INSERT INTO [form_log] (part_id, material_est_id) VALUES (@partId, NULL)`)

    return partId
  }

  async createPart(data: {
    orderId:       number
    partNumber:    string
    name:          string
    quantityRight: number
    deadlineAt:    string | null
  }): Promise<number> {
    const db = await getDb()
    const result = await db.request()
      .input('orderId',       sql.Int,          data.orderId)
      .input('partNumber',    sql.NVarChar(100), data.partNumber)
      .input('name',          sql.NVarChar(200), data.name)
      .input('quantityRight', sql.Int,           data.quantityRight)
      .input('deadlineAt',    sql.DateTime,      data.deadlineAt ? new Date(data.deadlineAt) : null)
      .query(`
        INSERT INTO [part]
          (order_id, part_number, name, symbol, quantity_right, quantity_left,
           deadline_at, card_printed, sticker_printed)
        OUTPUT INSERTED.id
        VALUES (@orderId, @partNumber, @name, NULL, @quantityRight, 0, @deadlineAt, 0, 0)
      `)
    const partId: number = result.recordset[0].id

    await db.request()
      .input('partId', sql.Int, partId)
      .query(`
        INSERT INTO [paths] (part_id) VALUES (@partId)
        DECLARE @pathsId INT = SCOPE_IDENTITY()
        UPDATE [part] SET paths_id = @pathsId WHERE id = @partId
        INSERT INTO [form_log] (part_id) VALUES (@partId)
      `)

    return partId
  }

  async updatePaths(partId: number, paths: { PDF_path?: string; DWG_path?: string; STP_path?: string }): Promise<void> {
    const cols = Object.keys(paths) as (keyof typeof paths)[]
    if (!cols.length) return
    const db  = await getDb()
    const colToParam: Record<string, string> = { PDF_path: '@pdfPath', DWG_path: '@dwgPath', STP_path: '@stpPath' }
    const req = db.request()
      .input('partId',  sql.Int,           partId)
      .input('pdfPath', sql.NVarChar(500), paths.PDF_path ?? null)
      .input('dwgPath', sql.NVarChar(500), paths.DWG_path ?? null)
      .input('stpPath', sql.NVarChar(500), paths.STP_path ?? null)
    const setClauses = cols.map(col => `${col} = ${colToParam[col]}`)
    await req.query(`
      IF EXISTS (SELECT 1 FROM [paths] WHERE part_id = @partId)
        UPDATE [paths] SET ${setClauses.join(', ')} WHERE part_id = @partId
      ELSE
        INSERT INTO [paths] (part_id, PDF_path, DWG_path, STP_path)
        VALUES (@partId, @pdfPath, @dwgPath, @stpPath)
    `)
  }

  async getAllByPhaseRange(minPhase: string, maxPhase?: string): Promise<PartWithOrder[]> {
    const db  = await getDb()
    const req = db.request().input('minPhase', sql.NVarChar(10), minPhase)
    let query: string
    if (maxPhase) {
      req.input('maxPhase', sql.NVarChar(10), maxPhase)
      query = `
        SELECT p.*, o.order_number, ph.name AS phase_name
        FROM   [part]  p
        JOIN   [order] o  ON o.id  = p.order_id
        LEFT JOIN [phase] ph ON ph.id = p.phase_id
        WHERE  p.phase_id IN (
          SELECT id FROM [phase]
          WHERE type = 'part'
            AND CAST(SUBSTRING(name, 2, LEN(name)) AS INT)
                BETWEEN CAST(SUBSTRING(@minPhase, 2, LEN(@minPhase)) AS INT)
                    AND CAST(SUBSTRING(@maxPhase, 2, LEN(@maxPhase)) AS INT)
        )
        ORDER BY o.order_number, p.part_number`
    } else {
      query = `
        SELECT p.*, o.order_number, ph.name AS phase_name
        FROM   [part]  p
        JOIN   [order] o  ON o.id  = p.order_id
        LEFT JOIN [phase] ph ON ph.id = p.phase_id
        WHERE  p.phase_id IN (
          SELECT id FROM [phase]
          WHERE type = 'part'
            AND CAST(SUBSTRING(name, 2, LEN(name)) AS INT)
                >= CAST(SUBSTRING(@minPhase, 2, LEN(@minPhase)) AS INT)
        )
        ORDER BY o.order_number, p.part_number`
    }
    const result = await req.query(query)
    return result.recordset as PartWithOrder[]
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
