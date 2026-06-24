import { getDb, sql } from '../config/database'
import { syncOrderPhase } from './order-phase.helper'

export interface CooperationLog {
  part_id:        number
  cooperation_id: number
  slot:           number   // 1 = kop1, 2 = kop2, 3 = kop3
  phase_id:       number | null
  cost:           number | null
}

export interface KoopPanelRow {
  part_id:          number
  slot:             number
  cooperation_id:   number
  phase_id:         number | null
  phase_name:       string | null
  cost:             number | null
  sent_at:          string | null
  received_at:      string | null
  part_number:      string
  part_name:        string
  quantity:         number
  order_number:     string
  cooperation_name: string
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
        .query(`
          DELETE FROM cooperation_log WHERE part_id = @partId AND slot = @slot

          -- Auto-faza detalu po usunięciu kooperacji
          DECLARE @d8Id    INT = (SELECT id FROM [phase] WHERE name = 'D8'       AND type = 'part')
          DECLARE @d10Id   INT = (SELECT id FROM [phase] WHERE name = 'D10'      AND type = 'part')
          DECLARE @exId    INT = (SELECT id FROM [phase] WHERE name = 'Wykonana' AND type = 'operation')
          DECLARE @total   INT = (SELECT COUNT(*) FROM operation_logs WHERE part_id = @partId)
          DECLARE @done    INT = (SELECT COUNT(*) FROM operation_logs WHERE part_id = @partId AND phase_id = @exId)
          DECLARE @hasKoop INT = (SELECT COUNT(*) FROM cooperation_log WHERE part_id = @partId)

          IF @total > 0 AND @total = @done
          BEGIN
            IF @hasKoop > 0
              UPDATE [part] SET phase_id = @d8Id
              WHERE id = @partId AND (phase_id IS NULL OR phase_id < @d8Id)
            ELSE
              UPDATE [part] SET phase_id = @d10Id
              WHERE id = @partId AND (phase_id IS NULL OR phase_id < @d10Id)
          END
        `)
    } else {
      await db.request()
        .input('partId', sql.Int, partId)
        .input('coopId', sql.Int, cooperationId)
        .input('slot',   sql.Int, slot)
        .query(`
          DECLARE @pendingId   INT = (SELECT id FROM [phase] WHERE name = 'Oczekuje' AND type = 'operation')
          DECLARE @exId        INT = (SELECT id FROM [phase] WHERE name = 'Wykonana' AND type = 'operation')
          DECLARE @d8Id        INT = (SELECT id FROM [phase] WHERE name = 'D8'       AND type = 'part')
          DECLARE @d10Id       INT = (SELECT id FROM [phase] WHERE name = 'D10'      AND type = 'part')
          DECLARE @curPartPhase INT = (SELECT phase_id FROM [part] WHERE id = @partId)

          -- Jeśli detal jest już D10+, nowa kooperacja traktowana jako zrealizowana
          DECLARE @newCoopPhase INT = CASE WHEN @curPartPhase >= @d10Id THEN @exId ELSE @pendingId END

          IF EXISTS (SELECT 1 FROM cooperation_log WHERE part_id = @partId AND slot = @slot)
            UPDATE cooperation_log
            SET cooperation_id = @coopId
            WHERE part_id = @partId AND slot = @slot
          ELSE
            INSERT INTO cooperation_log (part_id, cooperation_id, slot, phase_id)
            VALUES (@partId, @coopId, @slot, @newCoopPhase)

          -- Cofaj do D8 tylko jeśli detal NIE jest już na D10+
          IF @curPartPhase < @d10Id OR @curPartPhase IS NULL
          BEGIN
            DECLARE @total2 INT = (SELECT COUNT(*) FROM operation_logs WHERE part_id = @partId)
            DECLARE @done2  INT = (SELECT COUNT(*) FROM operation_logs WHERE part_id = @partId AND phase_id = @exId)
            IF @total2 > 0 AND @total2 = @done2
              UPDATE [part] SET phase_id = @d8Id
              WHERE id = @partId AND (phase_id IS NULL OR phase_id < @d8Id)
          END
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
      SELECT
        cl.part_id, cl.cooperation_id, cl.slot, cl.phase_id, cl.cost,
        CONVERT(nvarchar(30), cl.sent_at,     127) AS sent_at,
        CONVERT(nvarchar(30), cl.received_at, 127) AS received_at,
        ph.name AS phase_name
      FROM cooperation_log cl
      LEFT JOIN [phase] ph ON ph.id = cl.phase_id
      WHERE cl.part_id IN (${partIds.join(',')})
    `)
    return result.recordset as CooperationLog[]
  }

  async cyclePhase(partId: number, slot: number): Promise<{
    phase_id:    number | null
    phase_name:  string | null
    sent_at:     string | null
    received_at: string | null
  } | null> {
    const db = await getDb()
    const result = await db.request()
      .input('partId', sql.Int, partId)
      .input('slot',   sql.Int, slot)
      .query(`
        DECLARE @oczId   INT = (SELECT id FROM [phase] WHERE name = 'Oczekuje'     AND type = 'operation')
        DECLARE @wRealId INT = (SELECT id FROM [phase] WHERE name = 'W realizacji' AND type = 'operation')
        DECLARE @exId    INT = (SELECT id FROM [phase] WHERE name = 'Wykonana'     AND type = 'operation')

        DECLARE @curPhase INT = (SELECT phase_id FROM cooperation_log WHERE part_id = @partId AND slot = @slot)
        DECLARE @nextPhase INT =
          CASE @curPhase
            WHEN @oczId   THEN @wRealId
            WHEN @wRealId THEN @exId
            ELSE NULL
          END

        IF @nextPhase IS NOT NULL
        BEGIN
          UPDATE cooperation_log
          SET
            phase_id    = @nextPhase,
            sent_at     = CASE
                            WHEN @nextPhase = @wRealId AND sent_at IS NULL THEN GETDATE()
                            ELSE sent_at
                          END,
            received_at = CASE
                            WHEN @nextPhase = @wRealId THEN NULL
                            WHEN @nextPhase = @exId AND received_at IS NULL THEN GETDATE()
                            ELSE received_at
                          END
          WHERE part_id = @partId AND slot = @slot

          -- Auto D8/D9/D10 na podstawie aktualnego stanu kooperacji
          DECLARE @d8Id2     INT = (SELECT id FROM [phase] WHERE name = 'D8'  AND type = 'part')
          DECLARE @d9Id      INT = (SELECT id FROM [phase] WHERE name = 'D9'  AND type = 'part')
          DECLARE @d10Id2    INT = (SELECT id FROM [phase] WHERE name = 'D10' AND type = 'part')
          DECLARE @totalKoop INT = (SELECT COUNT(*) FROM cooperation_log WHERE part_id = @partId)
          DECLARE @doneKoop  INT = (SELECT COUNT(*) FROM cooperation_log WHERE part_id = @partId AND phase_id = @exId)
          DECLARE @inProg    INT = (SELECT COUNT(*) FROM cooperation_log WHERE part_id = @partId AND phase_id = @wRealId)
          DECLARE @totalOps  INT = (SELECT COUNT(*) FROM operation_logs   WHERE part_id = @partId)
          DECLARE @doneOps   INT = (SELECT COUNT(*) FROM operation_logs   WHERE part_id = @partId AND phase_id = @exId)

          IF @totalOps > 0 AND @totalOps = @doneOps
          BEGIN
            IF @doneKoop = @totalKoop AND @totalKoop > 0
              UPDATE [part] SET phase_id = @d10Id2 WHERE id = @partId
            ELSE IF @doneKoop > 0 OR @inProg > 0
              UPDATE [part] SET phase_id = @d9Id   WHERE id = @partId
            ELSE IF @totalKoop > 0
              UPDATE [part] SET phase_id = @d8Id2  WHERE id = @partId
          END
        END

        SELECT
          cl.phase_id,
          ph.name AS phase_name,
          CONVERT(nvarchar(30), cl.sent_at,     127) AS sent_at,
          CONVERT(nvarchar(30), cl.received_at, 127) AS received_at
        FROM cooperation_log cl
        LEFT JOIN [phase] ph ON ph.id = cl.phase_id
        WHERE cl.part_id = @partId AND cl.slot = @slot
      `)
    const row = result.recordset[0]
    if (!row) return null
    await syncOrderPhase(partId)
    return {
      phase_id:    row.phase_id    ?? null,
      phase_name:  row.phase_name  ?? null,
      sent_at:     row.sent_at     ?? null,
      received_at: row.received_at ?? null,
    }
  }

  async getAllForPanel(): Promise<KoopPanelRow[]> {
    const db = await getDb()
    const result = await db.request().query(`
      DECLARE @d8Id  INT = (SELECT id FROM [phase] WHERE name = 'D8'  AND type = 'part')
      DECLARE @d9Id  INT = (SELECT id FROM [phase] WHERE name = 'D9'  AND type = 'part')
      DECLARE @d10Id INT = (SELECT id FROM [phase] WHERE name = 'D10' AND type = 'part')
      SELECT
        cl.part_id, cl.slot, cl.cooperation_id,
        cl.phase_id, cl.cost,
        CONVERT(nvarchar(30), cl.sent_at, 127) AS sent_at,
        CONVERT(nvarchar(30), CASE WHEN ph.name = 'W realizacji' THEN NULL ELSE cl.received_at END, 127) AS received_at,
        p.part_number, p.name AS part_name,
        (COALESCE(p.quantity_right, 0) + COALESCE(p.quantity_left, 0)) AS quantity,
        o.order_number,
        c.name AS cooperation_name,
        ph.name AS phase_name
      FROM cooperation_log cl
      JOIN [part]        p  ON p.id  = cl.part_id AND p.phase_id IN (@d8Id, @d9Id, @d10Id)
      JOIN [order]       o  ON o.id  = p.order_id
      JOIN cooperation   c  ON c.id  = cl.cooperation_id
      LEFT JOIN [phase]  ph ON ph.id = cl.phase_id
      ORDER BY o.order_number, p.part_number
    `)
    return result.recordset as KoopPanelRow[]
  }

  async updateDates(partId: number, slot: number, sentAt: string | null, receivedAt: string | null): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',     sql.Int,       partId)
      .input('slot',       sql.Int,       slot)
      .input('sentAt',     sql.DateTime2, sentAt     ? new Date(sentAt)     : null)
      .input('receivedAt', sql.DateTime2, receivedAt ? new Date(receivedAt) : null)
      .query(`
        DECLARE @wRealId2 INT = (SELECT id FROM [phase] WHERE name = 'W realizacji' AND type = 'operation')
        UPDATE cooperation_log
        SET
          sent_at     = @sentAt,
          received_at = CASE WHEN phase_id = @wRealId2 THEN NULL ELSE @receivedAt END
        WHERE part_id = @partId AND slot = @slot
      `)
  }

  async updatePhase(partId: number, slot: number, phaseId: number): Promise<void> {
    const db = await getDb()
    await db.request()
      .input('partId',  sql.Int, partId)
      .input('slot',    sql.Int, slot)
      .input('phaseId', sql.Int, phaseId)
      .query(`
        DECLARE @oczId     INT = (SELECT id FROM [phase] WHERE name = 'Oczekuje'     AND type = 'operation')
        DECLARE @wRealId   INT = (SELECT id FROM [phase] WHERE name = 'W realizacji' AND type = 'operation')
        DECLARE @exId      INT = (SELECT id FROM [phase] WHERE name = 'Wykonana'     AND type = 'operation')

        UPDATE cooperation_log
        SET
          phase_id    = @phaseId,
          sent_at     = CASE
                          WHEN @phaseId = @oczId   THEN NULL
                          WHEN @phaseId = @wRealId AND sent_at IS NULL THEN GETDATE()
                          ELSE sent_at
                        END,
          received_at = CASE
                          WHEN @phaseId = @oczId   THEN NULL
                          WHEN @phaseId = @wRealId THEN NULL
                          WHEN @phaseId = @exId    AND received_at IS NULL THEN GETDATE()
                          ELSE received_at
                        END
        WHERE part_id = @partId AND slot = @slot

        -- Auto D8/D9/D10 na podstawie aktualnego stanu kooperacji
        DECLARE @d8Id2     INT = (SELECT id FROM [phase] WHERE name = 'D8'  AND type = 'part')
        DECLARE @d9Id      INT = (SELECT id FROM [phase] WHERE name = 'D9'  AND type = 'part')
        DECLARE @d10Id2    INT = (SELECT id FROM [phase] WHERE name = 'D10' AND type = 'part')
        DECLARE @totalKoop INT = (SELECT COUNT(*) FROM cooperation_log WHERE part_id = @partId)
        DECLARE @doneKoop  INT = (SELECT COUNT(*) FROM cooperation_log WHERE part_id = @partId AND phase_id = @exId)
        DECLARE @inProg    INT = (SELECT COUNT(*) FROM cooperation_log WHERE part_id = @partId AND phase_id = @wRealId)
        DECLARE @totalOps2 INT = (SELECT COUNT(*) FROM operation_logs   WHERE part_id = @partId)
        DECLARE @doneOps2  INT = (SELECT COUNT(*) FROM operation_logs   WHERE part_id = @partId AND phase_id = @exId)

        IF @totalOps2 > 0 AND @totalOps2 = @doneOps2
        BEGIN
          IF @doneKoop = @totalKoop AND @totalKoop > 0
            UPDATE [part] SET phase_id = @d10Id2 WHERE id = @partId
          ELSE IF @doneKoop > 0 OR @inProg > 0
            UPDATE [part] SET phase_id = @d9Id   WHERE id = @partId
          ELSE IF @totalKoop > 0
            UPDATE [part] SET phase_id = @d8Id2  WHERE id = @partId
        END
      `)
    await syncOrderPhase(partId)
  }
}

export const cooperationLogRepository = new CooperationLogRepository()
