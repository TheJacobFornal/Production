import { Router } from 'express'
import { cooperationLogRepository } from '../repositories/cooperation-log.repository'

const router = Router()

// POST /api/cooperation-log  { part_id, cooperation_id, slot }
router.post('/', async (req, res) => {
  try {
    const { part_id, cooperation_id, slot } = req.body
    if (!part_id || !slot) return res.status(400).json({ message: 'part_id i slot wymagane' })
    await cooperationLogRepository.upsertOrDelete(
      Number(part_id),
      cooperation_id != null ? Number(cooperation_id) : null,
      Number(slot),
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('cooperation-log POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/cooperation-log?partIds=1,2,3
router.get('/', async (req, res) => {
  try {
    const raw = req.query.partIds as string | undefined
    if (!raw) return res.json([])
    const ids = raw.split(',').map(Number).filter(Boolean)
    const logs = await cooperationLogRepository.getByPartIds(ids)
    res.json(logs)
  } catch (err) {
    console.error('cooperation-log GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/cooperation-log/cost
router.patch('/cost', async (req, res) => {
  try {
    const { part_id, slot, cost } = req.body
    if (!part_id || !slot) return res.status(400).json({ message: 'part_id i slot wymagane' })
    await cooperationLogRepository.updateCost(
      Number(part_id),
      Number(slot),
      cost != null && cost !== '' ? Number(cost) : null,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('cooperation-log PATCH cost error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/cooperation-log/phase
router.patch('/phase', async (req, res) => {
  try {
    const { part_id, slot, phase_id } = req.body
    if (!part_id || !slot || !phase_id) {
      return res.status(400).json({ message: 'part_id, slot i phase_id są wymagane' })
    }
    await cooperationLogRepository.updatePhase(Number(part_id), Number(slot), Number(phase_id))
    res.json({ ok: true })
  } catch (err) {
    console.error('cooperation-log PATCH phase error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
