import { getDb, sql } from '../config/database'

export interface FormLogDims {
  part_id:         number
  dim_a_est:       number | null
  dim_b_est:       number | null
  dim_c_est:       number | null
  dim_a_real:      number | null
  dim_b_real:      number | null
  dim_c_real:      number | null
  material_id:     number | null
  material_est_id: number | null
  weight_one:      number | null
  area_one:        number | null
}

class FormLogRepository {
  async upsertDims(
    partId: number,
    dimA:   number | null,
    dimB:   number | null,
    dimC:   number | null,
  ): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId', sql.Int,            partId)
      .input('dimA',   sql.Decimal(10, 4), dimA)
      .input('dimB',   sql.Decimal(10, 4), dimB)
      .input('dimC',   sql.Decimal(10, 4), dimC)
      .query(`
        IF EXISTS (SELECT 1 FROM form_log WHERE part_id = @partId)
          UPDATE form_log
          SET dim_a_est = @dimA,
              dim_b_est = @dimB,
              dim_c_est = @dimC
          WHERE part_id = @partId
        ELSE
          INSERT INTO form_log (part_id, dim_a_est, dim_b_est, dim_c_est)
          VALUES (@partId, @dimA, @dimB, @dimC)

        DECLARE @d3IdF INT = (SELECT id FROM [phase] WHERE name = 'D3' AND type = 'part')
        DECLARE @d2IdF INT = (SELECT id FROM [phase] WHERE name = 'D2' AND type = 'part')
        DECLARE @hasTimeF INT = (
          SELECT COUNT(*) FROM operation_logs
          WHERE part_id = @partId AND time_estimated IS NOT NULL
        )
        IF @hasTimeF >= 1
          UPDATE [part] SET phase_id = @d3IdF WHERE id = @partId AND (phase_id IS NULL OR phase_id < @d3IdF)
        ELSE
          UPDATE [part] SET phase_id = @d2IdF WHERE id = @partId AND phase_id = @d3IdF
      `)
  }

  async upsertReal(
    partId:     number,
    dimA:       number | null,
    dimB:       number | null,
    dimC:       number | null,
    materialId: number | null,
    weightOne:  number | null,
    areaOne:    number | null,
  ): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',     sql.Int,            partId)
      .input('dimA',       sql.Decimal(10, 4), dimA)
      .input('dimB',       sql.Decimal(10, 4), dimB)
      .input('dimC',       sql.Decimal(10, 4), dimC)
      .input('materialId', sql.Int,            materialId)
      .input('weightOne',  sql.Decimal(10, 4), weightOne)
      .input('areaOne',    sql.Decimal(10, 4), areaOne)
      .query(`
        IF EXISTS (SELECT 1 FROM form_log WHERE part_id = @partId)
          UPDATE form_log
          SET dim_a_real  = @dimA,
              dim_b_real  = @dimB,
              dim_c_real  = @dimC,
              material_id = @materialId,
              weight_one  = @weightOne,
              area_one    = @areaOne
          WHERE part_id = @partId
        ELSE
          INSERT INTO form_log (part_id, dim_a_real, dim_b_real, dim_c_real, material_id, weight_one, area_one)
          VALUES (@partId, @dimA, @dimB, @dimC, @materialId, @weightOne, @areaOne)
      `)
  }

  async upsertMaterialEst(partId: number, materialEstId: number | null): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',        sql.Int, partId)
      .input('materialEstId', sql.Int, materialEstId)
      .query(`
        IF EXISTS (SELECT 1 FROM form_log WHERE part_id = @partId)
          UPDATE form_log SET material_est_id = @materialEstId WHERE part_id = @partId
        ELSE
          INSERT INTO form_log (part_id, material_est_id) VALUES (@partId, @materialEstId)
      `)
  }

  async updateCostKit(partId: number, costKit: number | null): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',  sql.Int,            partId)
      .input('costKit', sql.Decimal(10, 2), costKit)
      .query(`
        IF EXISTS (SELECT 1 FROM form_log WHERE part_id = @partId)
          UPDATE form_log SET cost_kit = @costKit WHERE part_id = @partId
        ELSE
          INSERT INTO form_log (part_id, cost_kit) VALUES (@partId, @costKit)
      `)
  }

  async getByPartIds(partIds: number[]): Promise<FormLogDims[]> {
    if (!partIds.length) return []
    const db = await getDb()
    const result = await db.request()
      .query(`
        SELECT part_id, dim_a_est, dim_b_est, dim_c_est,
               dim_a_real, dim_b_real, dim_c_real, material_id, material_est_id, weight_one, area_one
        FROM form_log
        WHERE part_id IN (${partIds.join(',')})
      `)
    return result.recordset as FormLogDims[]
  }
}

export const formLogRepository = new FormLogRepository()
