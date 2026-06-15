import { getDb, sql } from '../config/database'

export interface Price {
  id:                  number
  part_id:             number
  cost_commercial_kit: number | null
  cost_labor_hour:     number | null
  cost_cooperation:    number | null
  cost_machining:      number | null
  price_kit:           number | null
  price_piece:         number | null
}

class PriceRepository {
  async upsert(
    partId:            number,
    costCommercialKit: number | null,
    costLaborHour:     number | null,
    costCooperation:   number | null,
    costMachining:     number | null,
    priceKit:          number | null,
    pricePiece:        number | null,
  ): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',            sql.Int,            partId)
      .input('costCommercialKit', sql.Decimal(10, 2), costCommercialKit)
      .input('costLaborHour',     sql.Decimal(10, 2), costLaborHour)
      .input('costCooperation',   sql.Decimal(10, 2), costCooperation)
      .input('costMachining',     sql.Decimal(10, 2), costMachining)
      .input('priceKit',          sql.Decimal(10, 2), priceKit)
      .input('pricePiece',        sql.Decimal(10, 2), pricePiece)
      .query(`
        IF EXISTS (SELECT 1 FROM [price] WHERE part_id = @partId)
          UPDATE [price]
          SET cost_commercial_kit = @costCommercialKit,
              cost_labor_hour     = @costLaborHour,
              cost_cooperation    = @costCooperation,
              cost_machining      = @costMachining,
              price_kit           = @priceKit,
              price_piece         = @pricePiece
          WHERE part_id = @partId
        ELSE
          INSERT INTO [price] (part_id, cost_commercial_kit, cost_labor_hour, cost_cooperation, cost_machining, price_kit, price_piece)
          VALUES (@partId, @costCommercialKit, @costLaborHour, @costCooperation, @costMachining, @priceKit, @pricePiece)
      `)
  }

  async getByPartIds(partIds: number[]): Promise<Price[]> {
    if (!partIds.length) return []
    const db = await getDb()
    const result = await db.request()
      .query(`
        SELECT * FROM [price]
        WHERE part_id IN (${partIds.join(',')})
      `)
    return result.recordset as Price[]
  }
}

export const priceRepository = new PriceRepository()
