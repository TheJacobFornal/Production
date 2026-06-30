import { Order, Part } from '../types/models'
import { getDb, sql } from '../config/database'

export interface OrderSummary {
  order_number: string
  deadline_at: Date | null
  parts_count: number
  phase_name: string | null
}

export interface OrderListItem {
  order_number:           string
  deadline_at:            Date | null
  parts_count:            number
  completed_count:        number
  d10_count:              number
  phase_name:             string | null
  missing_drawings_count: number
}

export interface NewOrderPart {
  part_number:          string
  name:                 string
  quantity_right:       number
  deadline_at:          string | null
  pdf_path:             string | null
  dwg_path:             string | null
  stp_path:             string | null
  material_id:          number | null
  kop1_id:              number | null
  kop2_id:              number | null
  kop3_id:              number | null
  compound_part_number?: string | null
}

export interface IOrderRepository {
  getAll(): Promise<Order[]>
  getAllSummary(): Promise<OrderListItem[]>
  getById(id: number): Promise<Order | null>
  getParts(orderId: number, minPhase?: string, maxPhase?: string): Promise<Part[]>
  getSummaryByOrderNumber(orderNumber: string): Promise<OrderSummary | null>
  readyForProduction(orderId: number): Promise<void>
  cancelOrder(orderId: number): Promise<void>
  deleteOrder(orderId: number): Promise<void>
  createOrder(orderNumber: string, typZamowienia?: string): Promise<number>
  createFullOrder(data: { order_number: string; typ_zamowienia: string | null; parts: NewOrderPart[] }): Promise<number>
}

class OrderRepository implements IOrderRepository {
  async getAll(): Promise<Order[]> {
    const db = await getDb()
    const result = await db.request()
      .query('SELECT * FROM [order] ORDER BY created_at DESC')
    return result.recordset as Order[]
  }

  async getAllSummary(): Promise<OrderListItem[]> {
    const db = await getDb()
    const result = await db.request().query(`
      SELECT
        o.order_number,
        MAX(p.deadline_at)                                                             AS deadline_at,
        COUNT(p.id)                                                                    AS parts_count,
        ISNULL(SUM(CASE WHEN p.phase_id >= d3ph.id  THEN 1 ELSE 0 END), 0)            AS completed_count,
        ISNULL(SUM(CASE WHEN p.phase_id  = d10ph.id THEN 1 ELSE 0 END), 0)            AS d10_count,
        ph.name                                                                        AS phase_name,
        ISNULL(SUM(CASE WHEN pt.part_id IS NULL
                          OR pt.PDF_path IS NULL
                          OR pt.DWG_path IS NULL
                          OR pt.STP_path IS NULL THEN 1 ELSE 0 END), 0)               AS missing_drawings_count
      FROM [order] o
      LEFT JOIN [part]  p  ON p.order_id = o.id
      LEFT JOIN [phase] ph ON ph.id      = o.phase_id
      LEFT JOIN [paths] pt ON pt.part_id = p.id
      CROSS JOIN (SELECT MIN(id) AS id FROM [phase] WHERE name = 'D3'  AND type = 'part') d3ph
      CROSS JOIN (SELECT MIN(id) AS id FROM [phase] WHERE name = 'D10' AND type = 'part') d10ph
      GROUP BY o.order_number, ph.name
      ORDER BY o.order_number
    `)
    return result.recordset as OrderListItem[]
  }

  async getById(id: number): Promise<Order | null> {
    const db = await getDb()
    const result = await db.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM [order] WHERE id = @id')
    return (result.recordset[0] ?? null) as Order | null
  }

  async getParts(orderId: number, minPhase?: string, maxPhase?: string): Promise<Part[]> {
    const db = await getDb()
    const req = db.request().input('orderId', sql.Int, orderId)
    let query: string
    if (minPhase && maxPhase) {
      req.input('minPhase', sql.NVarChar(10), minPhase)
      req.input('maxPhase', sql.NVarChar(10), maxPhase)
      query = `
        DECLARE @minId INT = (SELECT id FROM [phase] WHERE name = @minPhase AND type = 'part')
        DECLARE @maxId INT = (SELECT id FROM [phase] WHERE name = @maxPhase AND type = 'part')
        SELECT * FROM [part] WHERE order_id = @orderId AND phase_id >= @minId AND phase_id <= @maxId`
    } else if (minPhase) {
      req.input('minPhase', sql.NVarChar(10), minPhase)
      query = `
        DECLARE @minId INT = (SELECT id FROM [phase] WHERE name = @minPhase AND type = 'part')
        SELECT * FROM [part] WHERE order_id = @orderId AND phase_id >= @minId`
    } else {
      query = 'SELECT * FROM [part] WHERE order_id = @orderId'
    }
    const result = await req.query(query)
    return result.recordset as Part[]
  }

  async getSummaryByOrderNumber(orderNumber: string): Promise<OrderSummary | null> {
    const db = await getDb()
    const result = await db.request()
      .input('orderNumber', sql.NVarChar(100), orderNumber)
      .query(`
        SELECT
          o.order_number,
          MAX(p.deadline_at)  AS deadline_at,
          COUNT(p.id)         AS parts_count,
          ph.name             AS phase_name
        FROM [order] o
        LEFT JOIN [part]  p  ON p.order_id  = o.id
        LEFT JOIN [phase] ph ON ph.id       = o.phase_id
        WHERE o.order_number = @orderNumber
        GROUP BY o.order_number, ph.name
      `)
    return (result.recordset[0] ?? null) as OrderSummary | null
  }

  async readyForProduction(orderId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        DECLARE @z4Id INT = (SELECT id FROM phase WHERE name = 'Z4' AND type = 'order')
        DECLARE @d4Id INT = (SELECT id FROM phase WHERE name = 'D4' AND type = 'part')
        UPDATE [order] SET phase_id = @z4Id WHERE id = @orderId
        UPDATE [part]  SET phase_id = @d4Id
        WHERE  order_id = @orderId
        AND    ISNULL(phase_id, 0) NOT IN (
          SELECT id FROM phase WHERE name IN ('D6','D100','D101','D102') AND type = 'part'
        )
      `)
  }

  async cancelOrder(orderId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        DECLARE @z100Id INT = (SELECT id FROM phase WHERE name = 'Z100' AND type = 'order')
        UPDATE [order] SET phase_id = @z100Id WHERE id = @orderId
      `)
  }

  async deleteOrder(orderId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        UPDATE [part] SET paths_id = NULL, compound_id = NULL WHERE order_id = @orderId
        DELETE c FROM [commercial] c JOIN [form_log] fl ON fl.id = c.form_id WHERE fl.part_id IN (SELECT id FROM [part] WHERE order_id = @orderId)
        DELETE [paths]            WHERE part_id IN (SELECT id FROM [part] WHERE order_id = @orderId)
        DELETE [form_log]         WHERE part_id IN (SELECT id FROM [part] WHERE order_id = @orderId)
        DELETE [operation_logs]   WHERE part_id IN (SELECT id FROM [part] WHERE order_id = @orderId)
        DELETE [cooperation_log]  WHERE part_id IN (SELECT id FROM [part] WHERE order_id = @orderId)
        DELETE [price]            WHERE part_id IN (SELECT id FROM [part] WHERE order_id = @orderId)
        DELETE [part]             WHERE order_id = @orderId
        DELETE [order]            WHERE id = @orderId
      `)
  }

  async createFullOrder(data: { order_number: string; typ_zamowienia: string | null; parts: NewOrderPart[] }): Promise<number> {
    const db = await getDb()
    const transaction = new sql.Transaction(db)

    try {
      await transaction.begin()

      const phaseRows = await new sql.Request(transaction).query(`
        SELECT name, id FROM [phase]
        WHERE (name = 'Z2' AND type = 'order') OR (name = 'D1' AND type = 'part') OR (name = 'D2' AND type = 'part')
      `)
      const z2Id: number = phaseRows.recordset.find((r: any) => r.name === 'Z2')?.id ?? null
      const d1Id: number = phaseRows.recordset.find((r: any) => r.name === 'D1')?.id ?? null
      const d2Id: number = phaseRows.recordset.find((r: any) => r.name === 'D2')?.id ?? null

      const orderResult = await new sql.Request(transaction)
        .input('orderNumber', sql.NVarChar(100), data.order_number)
        .input('phaseId',     sql.Int,            z2Id)
        .input('typ',         sql.NVarChar(3),    data.typ_zamowienia ?? null)
        .query(`
          INSERT INTO [order] (order_number, phase_id, typ_zamowienia)
          OUTPUT INSERTED.id
          VALUES (@orderNumber, @phaseId, @typ)
        `)
      const orderId: number = orderResult.recordset[0].id

      // part_number → partId — potrzebne do rozwiązania compound_part_number
      const partNumToId = new Map<string, number>()
      const compoundPending: Array<{ partId: number; compound_part_number: string }> = []

      for (const part of data.parts) {
        const hasAllPaths = !!(part.pdf_path && part.dwg_path && part.stp_path)
        const partResult = await new sql.Request(transaction)
          .input('orderId',  sql.Int,           orderId)
          .input('pn',       sql.NVarChar(100),  part.part_number)
          .input('name',     sql.NVarChar(200),  part.name)
          .input('qty',      sql.Int,            part.quantity_right)
          .input('deadline', sql.DateTime,       part.deadline_at ? new Date(part.deadline_at) : null)
          .input('phaseId',  sql.Int,            hasAllPaths ? d2Id : d1Id)
          .query(`
            INSERT INTO [part]
              (order_id, part_number, name, quantity_right, quantity_left,
               deadline_at, phase_id, card_printed, sticker_printed)
            OUTPUT INSERTED.id
            VALUES (@orderId, @pn, @name, @qty, 0, @deadline, @phaseId, 0, 0)
          `)
        const partId: number = partResult.recordset[0].id
        partNumToId.set(part.part_number, partId)
        if (part.compound_part_number) {
          compoundPending.push({ partId, compound_part_number: part.compound_part_number })
        }

        const pathsResult = await new sql.Request(transaction)
          .input('partId', sql.Int,          partId)
          .input('pdf',    sql.NVarChar(500), part.pdf_path ?? null)
          .input('dwg',    sql.NVarChar(500), part.dwg_path ?? null)
          .input('stp',    sql.NVarChar(500), part.stp_path ?? null)
          .query(`
            INSERT INTO [paths] (part_id, PDF_path, DWG_path, STP_path)
            OUTPUT INSERTED.id
            VALUES (@partId, @pdf, @dwg, @stp)
          `)
        const pathsId: number = pathsResult.recordset[0].id

        await new sql.Request(transaction)
          .input('pathsId', sql.Int, pathsId)
          .input('partId',  sql.Int, partId)
          .query(`UPDATE [part] SET paths_id = @pathsId WHERE id = @partId`)

        await new sql.Request(transaction)
          .input('partId', sql.Int, partId)
          .input('matId',  sql.Int, part.material_id ?? null)
          .query(`INSERT INTO [form_log] (part_id, material_est_id) VALUES (@partId, @matId)`)

        const kops: [number | null, number][] = [
          [part.kop1_id, 1],
          [part.kop2_id, 2],
          [part.kop3_id, 3],
        ]
        for (const [kopId, slot] of kops) {
          if (kopId) {
            await new sql.Request(transaction)
              .input('partId', sql.Int, partId)
              .input('copId',  sql.Int, kopId)
              .input('slot',   sql.Int, slot)
              .query(`INSERT INTO [cooperation_log] (part_id, cooperation_id, slot) VALUES (@partId, @copId, @slot)`)
          }
        }
      }

      // Ustawia compound_id dla sub-detali złożeń
      for (const { partId, compound_part_number } of compoundPending) {
        const compoundId = partNumToId.get(compound_part_number)
        if (compoundId) {
          await new sql.Request(transaction)
            .input('partId',     sql.Int, partId)
            .input('compoundId', sql.Int, compoundId)
            .query('UPDATE [part] SET compound_id = @compoundId WHERE id = @partId')
        }
      }

      await transaction.commit()
      return orderId
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  }

  async createOrder(orderNumber: string, typZamowienia?: string): Promise<number> {
    const db = await getDb()
    const result = await db.request()
      .input('orderNumber', sql.NVarChar(100), orderNumber)
      .input('typZamowienia', sql.NVarChar(3), typZamowienia ?? null)
      .query(`
        DECLARE @phaseId INT = (SELECT id FROM [phase] WHERE name = 'Z2' AND type = 'order')
        INSERT INTO [order] (order_number, phase_id, typ_zamowienia)
        OUTPUT INSERTED.id
        VALUES (@orderNumber, @phaseId, @typZamowienia)
      `)
    return result.recordset[0].id as number
  }
}

export const orderRepository: IOrderRepository = new OrderRepository()
