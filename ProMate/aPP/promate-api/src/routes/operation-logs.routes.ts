import { Router } from 'express'
import { operationLogsRepository } from '../repositories/operation-logs.repository'

const router = Router()

// POST /api/operation-logs — upsert (insert or update)
router.post('/', async (req, res) => {
  try {
    const { part_id, operation_id, time_estimated, operation_order, phase_id } = req.body
    if (!part_id || !operation_id) {
      return res.status(400).json({ message: 'part_id i operation_id są wymagane' })
    }
    await operationLogsRepository.upsert(
      Number(part_id),
      Number(operation_id),
      time_estimated != null ? Number(time_estimated) : null,
      operation_order != null ? Number(operation_order) : null,
      phase_id        != null ? Number(phase_id)        : null,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('operation-logs POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/operation-logs?partIds=1,2,3
router.get('/', async (req, res) => {
  try {
    const raw = req.query.partIds as string | undefined
    if (!raw) return res.json([])
    const ids = raw.split(',').map(Number).filter(Boolean)
    const logs = await operationLogsRepository.getByPartIds(ids)
    res.json(logs)
  } catch (err) {
    console.error('operation-logs GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/operation-logs/real — zapis time_real (czas rzeczywisty w minutach)
router.patch('/real', async (req, res) => {
  try {
    const { part_id, operation_id, time_real } = req.body
    if (!part_id || !operation_id) {
      return res.status(400).json({ message: 'part_id i operation_id są wymagane' })
    }
    await operationLogsRepository.upsertReal(
      Number(part_id),
      Number(operation_id),
      time_real != null && time_real !== '' ? Number(time_real) : null,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('operation-logs PATCH real error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/operation-logs/notes
router.patch('/notes', async (req, res) => {
  try {
    const { part_id, operation_id, notes } = req.body
    if (!part_id || !operation_id) {
      return res.status(400).json({ message: 'part_id i operation_id są wymagane' })
    }
    await operationLogsRepository.updateNotes(
      Number(part_id),
      Number(operation_id),
      notes != null && notes !== '' ? String(notes) : null,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('operation-logs PATCH notes error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/operation-logs/phase
router.patch('/phase', async (req, res) => {
  try {
    const { part_id, operation_id, phase_id } = req.body
    if (!part_id || !operation_id || !phase_id) {
      return res.status(400).json({ message: 'part_id, operation_id i phase_id są wymagane' })
    }
    await operationLogsRepository.updatePhase(Number(part_id), Number(operation_id), Number(phase_id))
    res.json({ ok: true })
  } catch (err) {
    console.error('operation-logs PATCH phase error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
