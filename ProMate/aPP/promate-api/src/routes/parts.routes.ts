import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { partsRepository } from '../repositories/parts.repository'

const router = Router()

// POST /api/parts/load-from-folder
router.post('/load-from-folder', async (req, res) => {
  try {
    const { folderPath, orderId, parts } = req.body as {
      folderPath: string
      orderId:    number
      parts: { id: number; part_number: string; needsPDF: boolean; needsDWG: boolean; needsSTP: boolean }[]
    }
    if (!folderPath || !parts?.length) return res.json({ updated: 0 })

    // GC010.08.10.02.03A → gc010_08100203a
    const toKey = (n: string) => {
      const i = n.indexOf('.')
      if (i === -1) return n.toLowerCase()
      return (n.slice(0, i) + '_' + n.slice(i + 1).replace(/\./g, '')).toLowerCase()
    }

    // ga14_80200101a → GA14.80.20.01.01A
    const parseSubNumber = (rawKey: string): string | null => {
      const u = rawKey.indexOf('_')
      if (u === -1) return null
      const prefix = rawKey.slice(0, u).toUpperCase()
      let rest = rawKey.slice(u + 1)
      let letter = ''
      if (rest.length > 0 && /[a-z]$/.test(rest)) { letter = rest.slice(-1).toUpperCase(); rest = rest.slice(0, -1) }
      if (!/^\d+$/.test(rest) || rest.length === 0 || rest.length % 2 !== 0) return null
      const pairs: string[] = []
      for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2))
      return prefix + '.' + pairs.join('.') + letter
    }

    // złożenie: kończy się literą i przed nią są '00', LUB kończy się na '00'
    const isAssembly = (pn: string): boolean => {
      const last = pn[pn.length - 1]
      if (/[A-Za-z]/.test(last)) {
        return pn.length >= 3 && pn[pn.length - 2] === '0' && pn[pn.length - 3] === '0'
      }
      return pn.endsWith('00')
    }

    const allOrderParts = await partsRepository.getPartsByOrderId(orderId)
    const partsByKey    = new Map(allOrderParts.map(p => [toKey(p.part_number), p]))

    const entries  = fs.readdirSync(folderPath, { withFileTypes: true })
    const topFiles = entries.filter(e => e.isFile()).map(e => e.name)
    const topDirs  = entries.filter(e => e.isDirectory()).map(e => e.name)

    let updated = 0

    for (const part of parts) {
      const key = toKey(part.part_number)

      if (isAssembly(part.part_number)) {
        // szukaj podfolderu zaczynającego się od klucza złożenia
        const subDirName = topDirs.find(d => d.toLowerCase().startsWith(key))
        if (!subDirName) continue

        const subDirPath = path.join(folderPath, subDirName)
        const subFiles   = fs.readdirSync(subDirPath, { withFileTypes: true })
          .filter(e => e.isFile()).map(e => e.name)

        // pliki samego złożenia
        const assemblyMatched: { PDF_path?: string; DWG_path?: string; STP_path?: string } = {}
        for (const fn of subFiles) {
          if (!fn.toLowerCase().includes(key)) continue
          const ext = path.extname(fn).toLowerCase()
          const fp  = path.join(subDirPath, fn)
          if (ext === '.pdf'                      && part.needsPDF && !assemblyMatched.PDF_path) assemblyMatched.PDF_path = fp
          if (ext === '.dwg'                      && part.needsDWG && !assemblyMatched.DWG_path) assemblyMatched.DWG_path = fp
          if ((ext === '.stp' || ext === '.step') && part.needsSTP && !assemblyMatched.STP_path) assemblyMatched.STP_path = fp
        }
        if (Object.keys(assemblyMatched).length) {
          await partsRepository.updatePaths(part.id, assemblyMatched)
          updated++
        }

        // szczegóły złożenia dziedziczone przez sub-detale
        const assemblyDetail = await partsRepository.getById(part.id)

        // grupuj pliki sub-detali wg klucza
        const subMap = new Map<string, { rawKey: string; name: string; PDF_path?: string; DWG_path?: string; STP_path?: string }>()
        for (const fn of subFiles) {
          if (fn.toLowerCase().includes(key)) continue  // pomiń pliki złożenia
          const ext = path.extname(fn).toLowerCase()
          if (!['.pdf', '.dwg', '.stp', '.step'].includes(ext)) continue
          const stem = path.basename(fn, path.extname(fn))
          const segs = stem.split('-')
          if (segs.length < 2) continue
          const rawNum = segs[0].toLowerCase()
          const subNum = parseSubNumber(rawNum)
          if (!subNum) continue
          const subKey = toKey(subNum)
          if (!subMap.has(subKey)) subMap.set(subKey, { rawKey: rawNum, name: segs[1].toUpperCase() })
          const entry = subMap.get(subKey)!
          const fp    = path.join(subDirPath, fn)
          if (ext === '.pdf'                      && !entry.PDF_path) entry.PDF_path = fp
          if (ext === '.dwg'                      && !entry.DWG_path) entry.DWG_path = fp
          if ((ext === '.stp' || ext === '.step') && !entry.STP_path) entry.STP_path = fp
        }

        for (const [subKey, sd] of subMap) {
          const subNum   = parseSubNumber(sd.rawKey)!
          const existing = partsByKey.get(subKey)

          if (!existing) {
            const newId = await partsRepository.createSubPart({
              orderId,
              partNumber:    subNum,
              name:          sd.name,
              symbol:        null,
              quantityRight: assemblyDetail?.quantity_right ?? 1,
              quantityLeft:  0,
              deadlineAt:    assemblyDetail?.deadline_at ?? null,
              linId:         null,
              compoundId:    part.id,
              pdfPath:       sd.PDF_path ?? null,
              dwgPath:       sd.DWG_path ?? null,
              stpPath:       sd.STP_path ?? null,
            })
            partsByKey.set(subKey, { id: newId, part_number: subNum, order_id: orderId } as any)
          } else {
            const toUpdate: { PDF_path?: string; DWG_path?: string; STP_path?: string } = {}
            if (sd.PDF_path) toUpdate.PDF_path = sd.PDF_path
            if (sd.DWG_path) toUpdate.DWG_path = sd.DWG_path
            if (sd.STP_path) toUpdate.STP_path = sd.STP_path
            if (Object.keys(toUpdate).length) await partsRepository.updatePaths(existing.id, toUpdate)
          }
          updated++
        }

      } else {
        // zwykły detal — skanuj top-level folder
        const matched: { PDF_path?: string; DWG_path?: string; STP_path?: string } = {}
        for (const fn of topFiles) {
          if (!fn.toLowerCase().includes(key)) continue
          const ext = path.extname(fn).toLowerCase()
          const fp  = path.join(folderPath, fn)
          if (ext === '.pdf'                      && part.needsPDF && !matched.PDF_path) matched.PDF_path = fp
          if (ext === '.dwg'                      && part.needsDWG && !matched.DWG_path) matched.DWG_path = fp
          if ((ext === '.stp' || ext === '.step') && part.needsSTP && !matched.STP_path) matched.STP_path = fp
        }
        if (Object.keys(matched).length) {
          await partsRepository.updatePaths(part.id, matched)
          updated++
        }
      }
    }

    res.json({ updated })
  } catch (err) {
    console.error('load-from-folder error:', err)
    res.status(500).json({ message: String(err) })
  }
})

// POST /api/parts  { order_id, part_number, name, quantity_right, deadline_at? }
router.post('/', async (req, res) => {
  try {
    const { order_id, part_number, name, quantity_right, deadline_at } = req.body
    if (!order_id || !part_number || !name) return res.status(400).json({ message: 'Wymagane: order_id, part_number, name' })
    const id = await partsRepository.createPart({
      orderId:       Number(order_id),
      partNumber:    String(part_number).trim(),
      name:          String(name).trim(),
      quantityRight: Number(quantity_right) || 1,
      deadlineAt:    deadline_at ?? null,
    })
    res.json({ id })
  } catch (err) {
    console.error('parts create error:', err)
    res.status(500).json({ message: String(err) })
  }
})

// GET /api/parts/all-in-phase?minPhase=D10&maxPhase=D11
router.get('/all-in-phase', async (req, res) => {
  try {
    const minPhase = (req.query.minPhase as string | undefined)?.trim()
    const maxPhase = (req.query.maxPhase as string | undefined)?.trim()
    if (!minPhase) return res.json([])
    const parts = await partsRepository.getAllByPhaseRange(minPhase, maxPhase)
    res.json(parts)
  } catch (err) {
    console.error('parts all-in-phase error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/parts/:id
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const part = await partsRepository.getById(Number(req.params.id))
    if (!part) return res.status(404).json({ message: 'Nie znaleziono detalu' })
    res.json(part)
  } catch (err) {
    console.error('parts getById error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/parts/paths?partIds=1,2,3
router.get('/paths', async (req, res) => {
  try {
    const ids = (req.query.partIds as string | undefined)
      ?.split(',').map(Number).filter(n => !isNaN(n) && n > 0) ?? []
    const paths = await partsRepository.getPathsByPartIds(ids)
    res.json(paths)
  } catch (err) {
    console.error('parts paths error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/parts/search?q=GC010
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim()
    if (!q) return res.json([])
    const results = await partsRepository.searchByNumber(q)
    res.json(results)
  } catch (err) {
    console.error('parts search error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/parts/:id/pdf — streams the PDF file from paths table
router.get('/:id(\\d+)/pdf', async (req, res) => {
  try {
    const pdfPath = await partsRepository.getPdfPath(Number(req.params.id))
    if (!pdfPath) return res.status(404).json({ message: 'Brak pliku PDF' })
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ message: 'Plik PDF nie istnieje' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    fs.createReadStream(pdfPath).pipe(res)
  } catch (err) {
    console.error('parts pdf error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/parts/:id/card-pdf — streams the generated card PDF from "Gotowe Karty" folder
router.get('/:id(\\d+)/card-pdf', async (req, res) => {
  try {
    const part = await partsRepository.getById(Number(req.params.id))
    if (!part) return res.status(404).json({ message: 'Nie znaleziono detalu' })
    const baseFolder  = process.env.PROMATE_FOLDER ?? 'C:\\Users\\JakubFornal\\Desktop\\ProMate_rysunki'
    const cardPath    = path.join(baseFolder, part.order_number, 'Gotowe Karty', `${part.part_number}_gotowy_zestaw.pdf`)
    if (!fs.existsSync(cardPath)) return res.status(404).json({ message: 'Brak pliku karty' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    fs.createReadStream(cardPath).pipe(res)
  } catch (err) {
    console.error('parts card-pdf error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/parts/:id/phase  { phase_id: number }
router.patch('/:id/phase', async (req, res) => {
  try {
    const partId  = Number(req.params.id)
    const { phase_id } = req.body
    if (!phase_id) return res.status(400).json({ message: 'phase_id wymagane' })
    await partsRepository.updatePhase(partId, Number(phase_id))
    res.json({ ok: true })
  } catch (err) {
    console.error('parts phase error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/parts/:id/rework  { rework_parent_part_id: number | null }
router.patch('/:id/rework', async (req, res) => {
  try {
    const partId       = Number(req.params.id)
    const { rework_parent_part_id } = req.body
    await partsRepository.setRework(
      partId,
      rework_parent_part_id != null ? Number(rework_parent_part_id) : null,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('parts rework error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/parts/:id/paths  { PDF_path?, DWG_path?, STP_path? }
router.patch('/:id/paths', async (req, res) => {
  try {
    const partId = Number(req.params.id)
    const { PDF_path, DWG_path, STP_path } = req.body
    const paths: Record<string, string | null> = {}
    if ('PDF_path' in req.body) paths.PDF_path = PDF_path ?? null
    if ('DWG_path' in req.body) paths.DWG_path = DWG_path ?? null
    if ('STP_path' in req.body) paths.STP_path = STP_path ?? null
    await partsRepository.updatePaths(partId, paths)
    res.json({ ok: true })
  } catch (err) {
    console.error('parts paths error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
