import { Router } from 'express'
import { operationsRepository } from '../repositories/operations.repository'

const router = Router()

// GET /api/operations
router.get('/', async (_req, res) => {
  try {
    const ops = await operationsRepository.getAll()
    res.json(ops)
  } catch (err) {
    console.error('operations GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
