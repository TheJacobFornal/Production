// Eksportuje dane z bazy testowej do pliku SQL gotowego do importu na produkcji
// Użycie:
//   node scripts/export-to-prod.js
// Wynik: scripts/export_test_to_prod.sql
// Import na prod:
//   node scripts/migrate.js export_test_to_prod.sql --env prod

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.test') })
const sql  = require('mssql')
const fs   = require('fs')
const path = require('path')

const config = {
  server:   (process.env.DB_HOST || 'localhost:1433').split(':')[0],
  port:     parseInt((process.env.DB_HOST || 'localhost:1433').split(':')[1] || '1433'),
  database: process.env.DB_NAME || 'promate_test',
  user:     process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options:  { encrypt: false, trustServerCertificate: true },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const str = v => v != null ? `N'${String(v).replace(/'/g, "''")}'` : 'NULL'
const num = v => v != null ? String(v)                              : 'NULL'
const bit = v => v ? 1 : 0
const dt  = v => {
  if (v == null) return 'NULL'
  try { return `'${new Date(v).toISOString().replace('T', ' ').split('.')[0]}'` }
  catch { return 'NULL' }
}

// ─── Generuj MERGE dla jednej tabeli (INSERT nowych + UPDATE istniejących) ────
async function exportTable(pool, tableName, columns, rowMapper) {
  let rows
  try {
    const result = await pool.request().query(`SELECT * FROM [${tableName}] ORDER BY id`)
    rows = result.recordset
  } catch (err) {
    console.warn(`  ⚠  [${tableName}] pominięto: ${err.message}`)
    return `-- [${tableName}]: pominięto (${err.message})\nGO\n\n`
  }

  if (!rows.length) {
    console.log(`  •  [${tableName}] brak danych`)
    return `-- [${tableName}]: brak danych\nGO\n\n`
  }

  const updateCols = columns.filter(c => c !== 'id')
  const updateSet  = updateCols.map(c => `T.[${c}] = S.[${c}]`).join(', ')
  const colList    = columns.join(', ')
  const srcCols    = columns.map(c => `S.[${c}]`).join(', ')

  const BATCH = 500
  const lines = []

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch     = rows.slice(i, i + BATCH)
    const valueRows = batch.map(r => `  (${rowMapper(r)})`).join(',\n')

    lines.push(
      `SET IDENTITY_INSERT [${tableName}] ON`,
      `MERGE [${tableName}] AS T`,
      `USING (VALUES`,
      valueRows,
      `) AS S (${colList})`,
      `ON T.id = S.id`,
      `WHEN MATCHED THEN UPDATE SET ${updateSet}`,
      `WHEN NOT MATCHED THEN INSERT (${colList}) VALUES (${srcCols});`,
      `SET IDENTITY_INSERT [${tableName}] OFF`,
      'GO',
      '',
    )
  }

  console.log(`  ✓  [${tableName}] ${rows.length} wierszy`)
  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🗄  Łączenie z: ${config.database} @ ${config.server}:${config.port}`)
  const pool = await sql.connect(config)
  console.log('✅ Połączono\n')

  const out = []

  out.push(`-- ================================================================
-- EKSPORT DANYCH: ${config.database}
-- Data eksportu: ${new Date().toLocaleString('pl-PL')}
-- Używa MERGE: istniejące wiersze są aktualizowane, nowe wstawiane
-- ================================================================
-- Jak zaimportować na produkcji:
--   node scripts/migrate.js export_test_to_prod.sql --env prod
-- ================================================================
SET NOCOUNT ON
GO

`)

  // Tabele w kolejności zależności FK
  out.push('-- ═══ 1. location ════════════════════\n')
  out.push(await exportTable(pool, 'location',
    ['id', 'name', 'place', 'barcode'],
    r => `${num(r.id)}, ${str(r.name)}, ${str(r.place)}, ${str(r.barcode)}`
  ))

  out.push('-- ═══ 2. phase ═══════════════════════\n')
  out.push(await exportTable(pool, 'phase',
    ['id', 'name', 'location_id', 'type', 'description'],
    r => `${num(r.id)}, ${str(r.name)}, ${num(r.location_id)}, ${str(r.type)}, ${str(r.description)}`
  ))

  out.push('-- ═══ 3. operation ═══════════════════\n')
  out.push(await exportTable(pool, 'operation',
    ['id', 'name', 'hour_cost', 'number_of_workers', 'barcode'],
    r => `${num(r.id)}, ${str(r.name)}, ${num(r.hour_cost)}, ${num(r.number_of_workers)}, ${str(r.barcode)}`
  ))

  out.push('-- ═══ 4. material ════════════════════\n')
  out.push(await exportTable(pool, 'material',
    ['id', 'name', 'density', 'cost', 'unit'],
    r => `${num(r.id)}, ${str(r.name)}, ${num(r.density)}, ${num(r.cost)}, ${str(r.unit)}`
  ))

  out.push('-- ═══ 5. cooperation ═════════════════\n')
  out.push(await exportTable(pool, 'cooperation',
    ['id', 'name', 'price', 'unit'],
    r => `${num(r.id)}, ${str(r.name)}, ${num(r.price)}, ${str(r.unit)}`
  ))

  out.push('-- ═══ 6. order ═══════════════════════\n')
  out.push(await exportTable(pool, 'order',
    ['id', 'order_number', 'MOS_number', 'created_at', 'closed_at', 'folder_path', 'all_drawings', 'barcode', 'phase_id', 'NagId'],
    r => `${num(r.id)}, ${str(r.order_number)}, ${str(r.MOS_number)}, ${dt(r.created_at)}, ${dt(r.closed_at)}, ${str(r.folder_path)}, ${bit(r.all_drawings)}, ${str(r.barcode)}, ${num(r.phase_id)}, ${str(r.NagId)}`
  ))

  out.push('-- ═══ 7. part ════════════════════════\n')
  out.push(await exportTable(pool, 'part',
    ['id', 'order_id', 'symbol', 'part_number', 'name', 'quantity_right', 'quantity_left', 'deadline_at', 'paths_id', 'price_id', 'phase_id', 'rework_parent_part_id', 'location_id', 'card_printed', 'sticker_printed', 'sticker_printed_at', 'barcode', 'finished_at', 'LinId'],
    r => `${num(r.id)}, ${num(r.order_id)}, ${str(r.symbol)}, ${str(r.part_number)}, ${str(r.name)}, ${num(r.quantity_right)}, ${num(r.quantity_left)}, ${dt(r.deadline_at)}, ${num(r.paths_id)}, ${num(r.price_id)}, ${num(r.phase_id)}, ${num(r.rework_parent_part_id)}, ${num(r.location_id)}, ${bit(r.card_printed)}, ${bit(r.sticker_printed)}, ${dt(r.sticker_printed_at)}, ${str(r.barcode)}, ${dt(r.finished_at)}, ${num(r.LinId)}`
  ))

  out.push('-- ═══ 8. paths ═══════════════════════\n')
  out.push(await exportTable(pool, 'paths',
    ['id', 'part_id', 'PDF_path', 'DWG_path', 'STP_path', 'CAM_path', 'card_path', 'all_drawings'],
    r => `${num(r.id)}, ${num(r.part_id)}, ${str(r.PDF_path)}, ${str(r.DWG_path)}, ${str(r.STP_path)}, ${str(r.CAM_path)}, ${str(r.card_path)}, ${bit(r.all_drawings)}`
  ))

  out.push('-- ═══ 9. operation_logs ══════════════\n')
  out.push(await exportTable(pool, 'operation_logs',
    ['id', 'part_id', 'operation_id', 'phase_id', 'time_estimated', 'time_real', 'operation_order', 'barcode', 'cost', 'notes'],
    r => `${num(r.id)}, ${num(r.part_id)}, ${num(r.operation_id)}, ${num(r.phase_id)}, ${num(r.time_estimated)}, ${num(r.time_real)}, ${num(r.operation_order)}, ${str(r.barcode)}, ${num(r.cost)}, ${str(r.notes)}`
  ))

  out.push('-- ═══ 10. cooperation_log ════════════\n')
  out.push(await exportTable(pool, 'cooperation_log',
    ['id', 'part_id', 'cooperation_id', 'slot', 'phase_id', 'cost'],
    r => `${num(r.id)}, ${num(r.part_id)}, ${num(r.cooperation_id)}, ${num(r.slot)}, ${num(r.phase_id)}, ${num(r.cost)}`
  ))

  out.push('-- ═══ 11. form_log ═══════════════════\n')
  out.push(await exportTable(pool, 'form_log',
    ['id', 'part_id', 'commercial_id', 'dim_a_est', 'dim_b_est', 'dim_c_est', 'material_est_id', 'dim_a_real', 'dim_b_real', 'dim_c_real', 'area_one', 'weight_one', 'weight_real_set', 'material_id', 'cost_kit'],
    r => `${num(r.id)}, ${num(r.part_id)}, ${num(r.commercial_id)}, ${num(r.dim_a_est)}, ${num(r.dim_b_est)}, ${num(r.dim_c_est)}, ${num(r.material_est_id)}, ${num(r.dim_a_real)}, ${num(r.dim_b_real)}, ${num(r.dim_c_real)}, ${num(r.area_one)}, ${num(r.weight_one)}, ${num(r.weight_real_set)}, ${num(r.material_id)}, ${num(r.cost_kit)}`
  ))

  out.push('-- ═══ 12. price ══════════════════════\n')
  out.push(await exportTable(pool, 'price',
    ['id', 'part_id', 'cost_commercial_kit', 'cost_labor_hour', 'cost_cooperation', 'cost_machining', 'price_kit', 'price_piece'],
    r => `${num(r.id)}, ${num(r.part_id)}, ${num(r.cost_commercial_kit)}, ${num(r.cost_labor_hour)}, ${num(r.cost_cooperation)}, ${num(r.cost_machining)}, ${num(r.price_kit)}, ${num(r.price_piece)}`
  ))

  out.push('-- ═══ 13. commercial ═════════════════\n')
  out.push(await exportTable(pool, 'commercial',
    ['id', 'form_id', 'cost', 'ordered_at', 'arrived_at', 'phase_id'],
    r => `${num(r.id)}, ${num(r.form_id)}, ${num(r.cost)}, ${dt(r.ordered_at)}, ${dt(r.arrived_at)}, ${num(r.phase_id)}`
  ))

  await pool.close()

  const outPath = path.join(__dirname, 'export_test_to_prod.sql')
  fs.writeFileSync(outPath, out.join(''), 'utf8')

  console.log(`\n✅ Eksport zapisany: ${outPath}`)
  console.log('\n📌 Aby zaimportować na produkcji:')
  console.log('   node scripts/migrate.js export_test_to_prod.sql --env prod\n')
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
