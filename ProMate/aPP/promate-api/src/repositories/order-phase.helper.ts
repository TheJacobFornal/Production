import { getDb, sql } from '../config/database'

/**
 * Synchronizuje status zamówienia na podstawie statusów jego detali i operacji.
 * Wywoływane po każdej zmianie fazy operacji, kooperacji lub detalu.
 *
 * Zasady:
 *  - Z6 (Wyprodukowane) — WSZYSTKIE detale mają status D10 lub D11
 *  - Z5 (W produkcji)   — przynajmniej jeden detal ma D7 LUB przynajmniej jedna operacja jest Wykonana/W realizacji
 *  - Jeśli zamówienie jest na Z6, a warunek nie jest spełniony → cofnij do Z5
 *
 * UWAGA: porównujemy po nazwie fazy, nie po ID — kolejność ID w bazie może nie zgadzać się z nazwami.
 */
export async function syncOrderPhase(partId: number): Promise<void> {
  const db = await getDb()

  // 1. Pobierz orderId
  const partRes = await db.request()
    .input('partId', sql.Int, partId)
    .query('SELECT order_id FROM [part] WHERE id = @partId')
  const orderId: number | undefined = partRes.recordset[0]?.order_id
  if (!orderId) return

  // 2. Pobierz id faz po nazwie (nie zakładamy kolejności ID)
  const phaseRes = await db.request().query(`
    SELECT name, id FROM [phase]
    WHERE (name IN ('D7','D10','D11') AND type = 'part')
       OR (name IN ('Z5','Z6')        AND type = 'order')
       OR (name IN ('Wykonana','W realizacji') AND type = 'operation')
  `)
  const phases: Record<string, number> = {}
  for (const row of phaseRes.recordset) phases[row.name] = row.id

  const d7Id    = phases['D7']
  const d10Id   = phases['D10']
  const d11Id   = phases['D11']
  const z5Id    = phases['Z5']
  const z6Id    = phases['Z6']
  const exId    = phases['Wykonana']
  const wRealId = phases['W realizacji']

  if (!d10Id || !z5Id || !z6Id) return

  // Lista ID faz "wyprodukowane" (D10 i D11) — porównanie po nazwie, nie po >= ID
  const producedIds = [d10Id, d11Id].filter(Boolean).join(',')

  // 3. Policz detale
  const partsRes = await db.request()
    .input('orderId', sql.Int, orderId)
    .input('d7Id',    sql.Int, d7Id ?? 0)
    .query(`
      SELECT
        COUNT(*)                                                                   AS totalParts,
        SUM(CASE WHEN phase_id IN (${producedIds}) THEN 1 ELSE 0 END)             AS producedParts,
        SUM(CASE WHEN phase_id = @d7Id             THEN 1 ELSE 0 END)             AS d7Parts
      FROM [part] WHERE order_id = @orderId
    `)
  const { totalParts, producedParts, d7Parts } = partsRes.recordset[0]

  // 4. Policz aktywne operacje
  const opsRes = await db.request()
    .input('orderId',  sql.Int, orderId)
    .input('exId',     sql.Int, exId    ?? 0)
    .input('wRealId',  sql.Int, wRealId ?? 0)
    .query(`
      SELECT COUNT(*) AS cnt
      FROM operation_logs ol
      JOIN [part] p ON p.id = ol.part_id
      WHERE p.order_id = @orderId
        AND (ol.phase_id = @exId OR ol.phase_id = @wRealId)
    `)
  const activeOps: number = opsRes.recordset[0].cnt

  // 5. Pobierz aktualny status zamówienia
  const orderRes = await db.request()
    .input('orderId', sql.Int, orderId)
    .query('SELECT phase_id FROM [order] WHERE id = @orderId')
  const currentPhase: number | null = orderRes.recordset[0]?.phase_id ?? null

  // 6. Ustaw nowy status
  if (totalParts > 0 && producedParts === totalParts) {
    // Wszystkie detale D10/D11 → Z6
    if (currentPhase === null || currentPhase < z6Id) {
      await db.request()
        .input('orderId', sql.Int, orderId)
        .input('z6Id',    sql.Int, z6Id)
        .query('UPDATE [order] SET phase_id = @z6Id WHERE id = @orderId')
    }
  } else {
    // Nie wszystkie detale D10/D11 → zamówienie nie może być Z6
    if (currentPhase === z6Id) {
      await db.request()
        .input('orderId', sql.Int, orderId)
        .input('z5Id',    sql.Int, z5Id)
        .query('UPDATE [order] SET phase_id = @z5Id WHERE id = @orderId')
    } else if ((d7Parts > 0 || activeOps > 0) && (currentPhase === null || currentPhase < z5Id)) {
      await db.request()
        .input('orderId', sql.Int, orderId)
        .input('z5Id',    sql.Int, z5Id)
        .query('UPDATE [order] SET phase_id = @z5Id WHERE id = @orderId')
    }
  }
}
