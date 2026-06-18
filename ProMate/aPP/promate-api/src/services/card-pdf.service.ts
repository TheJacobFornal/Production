import puppeteer from 'puppeteer'
import { PDFDocument } from 'pdf-lib'
import { getPrinters, print } from 'pdf-to-printer'
import fs from 'fs'
import path from 'path'
import { getDb, sql } from '../config/database'

interface CardData {
  part_number: string
  order_number: string
  deadline_at: string | null
  quantity_right: number
  material_name: string | null
  dim_a: number | null
  dim_b: number | null
  dim_c: number | null
  operations:    Array<{ name: string; notes: string | null }>
  cooperations:  Array<{ name: string }>
  pdf_drawing_path: string | null
  is_handlowka:  boolean
}

async function getCardData(partId: number): Promise<CardData | null> {
  const db = await getDb()

  const partResult = await db.request()
    .input('id', sql.Int, partId)
    .query(`
      SELECT p.part_number, p.quantity_right, p.deadline_at,
             o.order_number,
             fl.dim_a_est, fl.dim_b_est, fl.dim_c_est,
             m.name AS material_name,
             pa.PDF_path
      FROM   [part]     p
      JOIN   [order]    o  ON o.id  = p.order_id
      LEFT JOIN form_log   fl ON fl.part_id = p.id
      LEFT JOIN material   m  ON m.id  = fl.material_est_id
      LEFT JOIN paths      pa ON pa.part_id = p.id
      WHERE  p.id = @id
    `)

  if (!partResult.recordset[0]) return null
  const row = partResult.recordset[0]

  const opResult = await db.request()
    .input('id', sql.Int, partId)
    .query(`
      SELECT op.name, ol.notes
      FROM   operation_logs ol
      JOIN   [operation]   op ON op.id = ol.operation_id
      WHERE  ol.part_id = @id AND ISNULL(ol.time_estimated, 0) > 0
      ORDER  BY ISNULL(ol.operation_order, 99)
    `)

  const coopResult = await db.request()
    .input('id', sql.Int, partId)
    .query(`
      SELECT c.name
      FROM   cooperation_log cl
      JOIN   cooperation     c  ON c.id = cl.cooperation_id
      WHERE  cl.part_id = @id
      ORDER  BY cl.slot
    `)

  const commercialResult = await db.request()
    .input('id', sql.Int, partId)
    .query(`
      SELECT COUNT(*) AS cnt
      FROM   commercial c
      JOIN   form_log   fl ON fl.id = c.form_id
      WHERE  fl.part_id = @id
    `)

  return {
    part_number:       row.part_number,
    order_number:      row.order_number,
    deadline_at:       row.deadline_at ? String(row.deadline_at) : null,
    quantity_right:    row.quantity_right,
    material_name:     row.material_name ?? null,
    dim_a:             row.dim_a_est ?? null,
    dim_b:             row.dim_b_est ?? null,
    dim_c:             row.dim_c_est ?? null,
    operations:        opResult.recordset,
    cooperations:      coopResult.recordset,
    pdf_drawing_path:  row.PDF_path ?? null,
    is_handlowka:      (commercialResult.recordset[0]?.cnt ?? 0) > 0,
  }
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TOTAL_OP_ROWS = 14
const CHK = `<div style="width:15px;height:15px;border:1.5px solid #000;display:inline-block;vertical-align:middle"></div>`

function generateHtml(data: CardData, logoBase64: string): string {
  const opItems: Array<{ name: string; notes: string | null }> = [
    { name: 'PIŁA',      notes: null },
    ...data.operations,
    { name: 'ŚLUSARNIA', notes: null },
  ]
  const allRows: Array<{ name: string; notes: string | null }> = []
  opItems.forEach((item, i) => {
    allRows.push(item)
    if (i < opItems.length - 1) allRows.push({ name: '', notes: null })
  })
  if (data.cooperations.length > 0) {
    allRows.push({ name: '', notes: null })
    for (const c of data.cooperations) {
      allRows.push({ name: c.name, notes: null })
    }
  }
  while (allRows.length < TOTAL_OP_ROWS) allRows.push({ name: '', notes: null })

  const B = 'border:1px solid #000'
  const CELL = `${B};padding:2px 5px;font-size:14px;vertical-align:middle`
  const BOLD = `${CELL};font-weight:700;text-align:center`

  const opRows = allRows.map(op => `
    <tr style="height:46px">
      <td style="${CELL};font-weight:${op.name ? 700 : 400}">${op.name}</td>
      <td style="${CELL}">${op.notes ?? ''}</td>
      <td style="${CELL}"></td>
      <td style="${CELL};text-align:center">${op.name ? data.quantity_right : ''}</td>
      <td style="${CELL}"></td>
      <td style="${CELL};text-align:center">${CHK}</td>
      <td style="${CELL}"></td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="pl" style="height:100%">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      color: #000;
      background: #fff;
      position: relative;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 2px solid #000; }
  </style>
</head>
<body>

  ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" style="position:absolute;top:-35px;right:5px;height:70px;object-fit:contain">` : ''}
  <div style="text-align:center;font-weight:700;font-size:14px;margin-top:35px;margin-bottom:15px">
    KARTA WYROBU DETALU
  </div>

  <!-- Numer zamówienia / Termin realizacji -->
  <table style="flex-shrink:0">
    <colgroup>
      <col style="width:22%"><col style="width:46%">
      <col style="width:20%"><col style="width:12%">
    </colgroup>
    <tbody>
      <tr style="height:39px">
        <td style="${BOLD};white-space:nowrap">Numer zamówienia</td>
        <td style="${CELL}">${data.order_number}</td>
        <td style="${BOLD};white-space:nowrap">Termin realizacji</td>
        <td style="${CELL};white-space:nowrap">${fmtDate(data.deadline_at)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Przygotówka -->
  <table style="margin-top:-2px;flex-shrink:0">
    <colgroup>
      <col style="width:22%"><col style="width:13%">
      <col style="width:13%"><col style="width:13%">
      <col style="width:13%"><col style="width:26%">
    </colgroup>
    <tbody>
      <tr style="height:35px">
        <td colspan="6" style="${BOLD};padding:5px 7px">Przygotówka</td>
      </tr>
      <tr style="height:20px">
        <td rowspan="2" style="${BOLD};vertical-align:middle;white-space:nowrap">Gatunek materiału</td>
        <td colspan="4" style="${BOLD}">Formatka</td>
        <td rowspan="2" style="${BOLD};vertical-align:middle">Data</td>
      </tr>
      <tr style="height:20px">
        <td style="${BOLD}">Wysokość</td>
        <td style="${BOLD}">Szerokość</td>
        <td style="${BOLD}">Długość</td>
        <td style="${BOLD}">Handlówka</td>
      </tr>
      <tr style="height:45px">
        <td style="${CELL};text-align:center">${data.material_name ?? ''}</td>
        <td style="${CELL};text-align:center">${data.dim_a ?? ''}</td>
        <td style="${CELL};text-align:center">${data.dim_b ?? ''}</td>
        <td style="${CELL};text-align:center">${data.dim_c ?? ''}</td>
        <td style="${CELL};text-align:center;font-weight:${data.is_handlowka ? 700 : 400}">${data.is_handlowka ? 'TAK' : 'NIE'}</td>
        <td style="${CELL}"></td>
      </tr>
    </tbody>
  </table>

  <!-- Obróbka -->
  <div style="margin-top:-2px">
    <table>
      <colgroup>
        <col style="width:15%"><col style="width:24%"><col style="width:19%">
        <col style="width:8%"><col style="width:8%"><col style="width:10%"><col style="width:16%">
      </colgroup>
      <tbody>
        <tr style="height:35px">
          <td colspan="7" style="${BOLD};padding:5px 7px">Obróbka</td>
        </tr>
        <tr style="height:30px">
          <td style="${BOLD}">Operacja</td>
          <td style="${BOLD}">Uwagi</td>
          <td style="${BOLD}">Data</td>
          <td style="${BOLD}">Ilość</td>
          <td style="${BOLD}">Czas</td>
          <td style="${BOLD}">Kontrola</td>
          <td style="${BOLD}">Podpis</td>
        </tr>
        ${opRows}
      </tbody>
    </table>
  </div>

  <!-- Kontrola jakości -->
  <div style="margin-top:-2px">
    <table>
      <colgroup>
        <col style="width:15%"><col style="width:24%"><col style="width:19%">
        <col style="width:8%"><col style="width:8%"><col style="width:10%"><col style="width:16%">
      </colgroup>
      <tbody>
        <tr style="height:35px">
          <td colspan="7" style="${BOLD};padding:5px 7px">Kontrola jakości</td>
        </tr>
        <tr style="height:30px">
          <td colspan="2" style="${BOLD}">Podpis</td>
          <td colspan="2" style="${BOLD}">Data</td>
          <td style="${BOLD}">OK</td>
          <td colspan="2" style="${BOLD}">NOK</td>
        </tr>
        <tr style="height:46px">
          <td colspan="2" style="${CELL}"></td>
          <td colspan="2" style="${CELL}"></td>
          <td style="${CELL};text-align:center">${CHK}</td>
          <td colspan="2" style="${CELL};text-align:center">${CHK}</td>
        </tr>
      </tbody>
    </table>
  </div>

</body>
</html>`
}

export async function listPrinters(): Promise<string[]> {
  const list = await getPrinters()
  return list.map((p: { name: string }) => p.name)
}

export async function generateMergedPdfsForOrder(orderId: number): Promise<{ errors: string[] }> {
  const db = await getDb()
  const partsResult = await db.request()
    .input('orderId', sql.Int, orderId)
    .query('SELECT id, part_number FROM [part] WHERE order_id = @orderId')

  const parts: Array<{ id: number; part_number: string }> = partsResult.recordset
  const errors: string[] = []

  const logoPath = path.join(__dirname, '..', '..', '..', 'promate-client', 'public', 'Logo.png')
  let logoBase64 = ''
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString('base64')
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    for (const part of parts) {
      try {
        const data = await getCardData(part.id)
        if (!data) {
          errors.push(`${part.part_number}: brak danych`)
          continue
        }

        const page = await browser.newPage()
        let cardPdfBytes: Buffer
        try {
          await page.setViewport({ width: 794, height: 1123 })
          await page.setContent(generateHtml(data, logoBase64), { waitUntil: 'load' })
          const raw = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '5px', bottom: '40px', left: '40px', right: '40px' },
          })
          cardPdfBytes = Buffer.from(raw)
        } finally {
          await page.close()
        }

        const mergedDoc = await PDFDocument.create()

        const cardDoc = await PDFDocument.load(cardPdfBytes)
        const cardPages = await mergedDoc.copyPages(cardDoc, cardDoc.getPageIndices())
        cardPages.forEach(p => mergedDoc.addPage(p))

        if (data.pdf_drawing_path && fs.existsSync(data.pdf_drawing_path)) {
          const drawingBytes = fs.readFileSync(data.pdf_drawing_path)
          const drawingDoc = await PDFDocument.load(drawingBytes)
          const drawingPages = await mergedDoc.copyPages(drawingDoc, drawingDoc.getPageIndices())
          drawingPages.forEach(p => mergedDoc.addPage(p))
        } else {
          console.log(`  [BRAK RYSUNKU] ${data.part_number}: ${data.pdf_drawing_path ?? 'brak ścieżki'}`)
        }

        const baseFolder = process.env.PROMATE_FOLDER ?? 'C:\\Users\\JakubFornal\\Desktop\\ProMate_rysunki'
        const outputFolder = path.join(baseFolder, data.order_number, 'Gotowe Karty')
        fs.mkdirSync(outputFolder, { recursive: true })

        const outputPath = path.join(outputFolder, `${data.part_number}_gotowy_zestaw.pdf`)
        fs.writeFileSync(outputPath, await mergedDoc.save())
        console.log(`  [PDF] Zapisano: ${outputPath}`)

        const printerName = process.env.PROMATE_PRINTER ?? 'KONICA MINOLTA bizhub 224e KONSTRUKTORZY'
        try {
          const available = await getPrinters()
          const match = available.find((p: { name: string }) => p.name === printerName)
          if (!match) {
            throw new Error(`Drukarka "${printerName}" nie znaleziona. Dostępne: ${available.map((p: { name: string }) => p.name).join(', ')}`)
          }

          // await print(outputPath, { printer: match.name })
          console.log(`  [DRUK] WYŁĄCZONY (tymczasowo): ${data.part_number}`)

          await db.request()
            .input('partId', sql.Int, part.id)
            .query(`
              DECLARE @d6Id INT = (SELECT id FROM phase WHERE name = 'D6' AND type = 'part')
              UPDATE [part] SET phase_id = @d6Id WHERE id = @partId
            `)
          console.log(`  [STATUS] ${data.part_number} → D6`)
        } catch (printErr) {
          const msg = printErr instanceof Error ? printErr.message : String(printErr)
          console.error(`  [DRUK ERROR] ${data.part_number}: ${msg}`)
          errors.push(`DRUK ${data.part_number}: ${msg}`)
        }
      } catch (err) {
        console.error(`  [PDF ERROR] Part ${part.part_number}:`, err)
        errors.push(`${part.part_number}: ${String(err)}`)
      }
    }
  } finally {
    await browser.close()
  }

  return { errors }
}
