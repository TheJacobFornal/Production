import { getDb, sql } from '../config/database'

export interface CooperationLog {
  part_id:        number
  cooperation_id: number
  slot:           number   // 1 = kop1, 2 = kop2, 3 = kop3
  phase_id:       number | null
  cost:           number | null
}

class CooperationLogRepository {
  /** Upsert lub usuń slot (jeśli cooperationId === null) */
  async upsertOrDelete(
    partId:        number,
    cooperationId: number | null,
    slot:          number,
  ): Promise<void> {
    const db = await getDb()
    if (cooperationId === null) {
      await db.request()
        .input('partId', sql.Int, partId)
        .input('slot',   sql.Int, slot)
        .query('DELETE FROM cooperation_log WHERE part_id = @partId AND slot = @slot')
    } else {
      await db.request()
        .input('partId', sql.Int, partId)
        .input('coopId', sql.Int, cooperationId)
        .input('slot',   sql.Int, slot)
        .query(`
          DECLARE @defaultPhaseId INT = (SELECT id FROM [phase] WHERE name = 'Oczekuje' AND type = 'operation')
          IF EXISTS (SELECT 1 FROM cooperation_log WHERE part_id = @partId AND slot = @slot)
            UPDATE cooperation_log
            SET cooperation_id = @coopId
            WHERE part_id = @partId AND slot = @slot
          ELSE
            INSERT INTO cooperation_log (part_id, cooperation_id, slot, phase_id)
            VALUES (@partId, @coopId, @slot, @defaultPhaseId)
        `)
    }
  }

  async updateCost(partId: number, slot: number, cost: number | null): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId', sql.Int,            partId)
      .input('slot',   sql.Int,            slot)
      .input('cost',   sql.Decimal(10, 2), cost)
      .query('UPDATE cooperation_log SET cost = @cost WHERE part_id = @partId AND slot = @slot')
  }

  async getByPartIds(partIds: number[]): Promise<CooperationLog[]> {
    if (!partIds.length) return []
    const db = await getDb()
    const result = await db.request().query(`
      SELECT part_id, cooperation_id, slot, phase_id, cost
      FROM cooperation_log
      WHERE part_id IN (${partIds.join(',')})
    `)
    return result.recordset as CooperationLog[]
  }

  async updatePhase(partId: number, slot: number, phaseId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',  sql.Int, partId)
      .input('slot',    sql.Int, slot)
      .input('phaseId', sql.Int, phaseId)
      .query(`
        UPDATE cooperation_log
        SET phase_id = @phaseId
        WHERE part_id = @partId AND slot = @slot
      `)
  }
}

export const cooperationLogRepository = new CooperationLogRepository()
