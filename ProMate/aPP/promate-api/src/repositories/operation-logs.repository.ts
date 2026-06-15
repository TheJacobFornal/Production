import { getDb, sql } from '../config/database'

export interface OperationLog {
  id:              number
  part_id:         number
  operation_id:    number
  phase_id:        number | null
  time_estimated:  number | null
  time_real:       number | null
  operation_order: number | null
  barcode:         string | null
  cost:            number | null
}

class OperationLogsRepository {
  async upsert(
    partId:         number,
    operationId:    number,
    timeEstimated:  number | null,
    operationOrder: number | null,
    phaseId:        number | null,
  ): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',         sql.Int,            partId)
      .input('operationId',    sql.Int,            operationId)
      .input('timeEstimated',  sql.Decimal(10, 2), timeEstimated)
      .input('operationOrder', sql.Int,            operationOrder)
      .input('phaseId',        sql.Int,            phaseId)
      .query(`
        DECLARE @defaultPhaseId INT = (SELECT id FROM [phase] WHERE name = 'Oczekuje' AND type = 'operation')
        IF EXISTS (
          SELECT 1 FROM operation_logs
          WHERE part_id = @partId AND operation_id = @operationId
        )
          UPDATE operation_logs
          SET time_estimated  = @timeEstimated,
              operation_order = @operationOrder
          WHERE part_id = @partId AND operation_id = @operationId
        ELSE
          INSERT INTO operation_logs (part_id, operation_id, phase_id, time_estimated, operation_order)
          VALUES (@partId, @operationId, ISNULL(@phaseId, @defaultPhaseId), @timeEstimated, @operationOrder)

        DECLARE @d3Id INT = (SELECT id FROM [phase] WHERE name = 'D3' AND type = 'part')
        DECLARE @d2Id INT = (SELECT id FROM [phase] WHERE name = 'D2' AND type = 'part')
        -- D3 gdy: ≥1 czas operacji i ≥2 wymiary
        DECLARE @hasTime INT = (
          SELECT COUNT(*) FROM operation_logs
          WHERE part_id = @partId AND time_estimated IS NOT NULL
        )
        DECLARE @dimCount INT = ISNULL((
          SELECT CASE WHEN dim_a_est IS NOT NULL THEN 1 ELSE 0 END +
                 CASE WHEN dim_b_est IS NOT NULL THEN 1 ELSE 0 END +
                 CASE WHEN dim_c_est IS NOT NULL THEN 1 ELSE 0 END
          FROM form_log WHERE part_id = @partId
        ), 0)
        IF @hasTime >= 1 AND @dimCount >= 2
          UPDATE [part] SET phase_id = @d3Id WHERE id = @partId AND (phase_id IS NULL OR phase_id < @d3Id)
        ELSE
          UPDATE [part] SET phase_id = @d2Id WHERE id = @partId AND phase_id = @d3Id
      `)
  }

  async upsertReal(partId: number, operationId: number, timeReal: number | null): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',      sql.Int,            partId)
      .input('operationId', sql.Int,            operationId)
      .input('timeReal',    sql.Decimal(10, 2), timeReal)
      .query(`
        DECLARE @defaultPhaseId INT = (SELECT id FROM [phase] WHERE name = 'Oczekuje' AND type = 'operation')
        IF EXISTS (SELECT 1 FROM operation_logs WHERE part_id = @partId AND operation_id = @operationId)
          UPDATE operation_logs
          SET time_real = @timeReal
          WHERE part_id = @partId AND operation_id = @operationId
        ELSE
          INSERT INTO operation_logs (part_id, operation_id, phase_id, time_real)
          VALUES (@partId, @operationId, @defaultPhaseId, @timeReal)
      `)
  }

  async updatePhase(partId: number, operationId: number, phaseId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',      sql.Int, partId)
      .input('operationId', sql.Int, operationId)
      .input('phaseId',     sql.Int, phaseId)
      .query(`
        UPDATE operation_logs
        SET phase_id = @phaseId
        WHERE part_id = @partId AND operation_id = @operationId
      `)
  }

  async getByPartIds(partIds: number[]): Promise<OperationLog[]> {
    if (!partIds.length) return []
    const db = await getDb()
    const result = await db.request()
      .query(`
        SELECT * FROM operation_logs
        WHERE part_id IN (${partIds.join(',')})
      `)
    return result.recordset as OperationLog[]
  }
}

export const operationLogsRepository = new OperationLogsRepository()
