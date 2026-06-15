import { Router } from 'express'
import { cooperationRepository } from '../repositories/cooperation.repository'

const router = Router()

// GET /api/cooperations
router.get('/', async (_req, res) => {
  try {
    const list = await cooperationRepository.getAll()
    res.json(list)
  } catch (err) {
    console.error('cooperations GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
