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

export default router
