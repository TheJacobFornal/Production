import { Router } from 'express'
import { partsRepository } from '../repositories/parts.repository'

const router = Router()

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

export default router
