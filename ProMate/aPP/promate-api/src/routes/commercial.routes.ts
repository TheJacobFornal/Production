import { Router } from 'express'
import { commercialRepository } from '../repositories/commercial.repository'

const router = Router()

// POST /api/commercial  { part_id }  → utwórz rekord
router.post('/', async (req, res) => {
  try {
    const { part_id } = req.body
    if (!part_id) return res.status(400).json({ message: 'part_id wymagane' })
    await commercialRepository.create(Number(part_id))
    res.json({ ok: true })
  } catch (err) {
    console.error('commercial POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// DELETE /api/commercial?partId=5  → usuń rekord
router.delete('/', async (req, res) => {
  try {
    const partId = Number(req.query.partId)
    if (!partId) return res.status(400).json({ message: 'partId wymagane' })
    await commercialRepository.deleteByPartId(partId)
    res.json({ ok: true })
  } catch (err) {
    console.error('commercial DELETE error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/commercial?partIds=1,2,3  → lista part_id z zaznaczoną handlówką
router.get('/', async (req, res) => {
  try {
    const raw = req.query.partIds as string | undefined
    if (!raw) return res.json([])
    const ids = raw.split(',').map(Number).filter(Boolean)
    const checked = await commercialRepository.getCheckedPartIds(ids)
    res.json(checked)
  } catch (err) {
    console.error('commercial GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/commercial/parts  → wszystkie detale z commercial=true + dane zamówienia
router.get('/parts', async (_req, res) => {
  try {
    const parts = await commercialRepository.getAllParts()
    res.json(parts)
  } catch (err) {
    console.error('commercial GET /parts error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/commercial/:id/dates  → ręczna zmiana dat
router.patch('/:id/dates', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { ordered_at, arrived_at } = req.body as { ordered_at: string | null; arrived_at: string | null }
    if (!id) return res.status(400).json({ message: 'id wymagane' })
    await commercialRepository.updateDates(id, ordered_at ?? null, arrived_at ?? null)
    res.json({ ok: true })
  } catch (err) {
    console.error('commercial PATCH dates error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/commercial/:id/status  → aktualizuj status (ordered_at / arrived_at)
router.patch('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body as { status: 'Do zamówienia' | 'Zamówione' | 'Dotarło' }
    if (!id || !status) return res.status(400).json({ message: 'id i status wymagane' })
    await commercialRepository.updateStatus(id, status)
    res.json({ ok: true })
  } catch (err) {
    console.error('commercial PATCH status error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
