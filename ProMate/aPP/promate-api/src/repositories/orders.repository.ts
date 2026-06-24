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

export interface IOrderRepository {
  getAll(): Promise<Order[]>
  getAllSummary(): Promise<OrderListItem[]>
  getById(id: number): Promise<Order | null>
  getParts(orderId: number, minPhase?: string, maxPhase?: string): Promise<Part[]>
  getSummaryByOrderNumber(orderNumber: string): Promise<OrderSummary | null>
  readyForProduction(orderId: number): Promise<void>
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
        UPDATE [part]  SET phase_id = @d4Id WHERE order_id = @orderId AND phase_id != (SELECT id FROM phase WHERE name = 'D6' AND type = 'part')
      `)
  }
}

export const orderRepository: IOrderRepository = new OrderRepository()
