import { Router } from 'express'
import { cooperationRepository } from '../repositories/cooperation.repository'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    res.json(await cooperationRepository.getAll())
  } catch (err) {
    console.error('cooperations GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, price, unit } = req.body
    if (!name) return res.status(400).json({ message: 'name wymagane' })
    const id = await cooperationRepository.upsert(null, name, price ?? null, unit ?? null)
    res.json({ id })
  } catch (err) {
    console.error('cooperations POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, price, unit } = req.body
    if (!name) return res.status(400).json({ message: 'name wymagane' })
    await cooperationRepository.upsert(Number(req.params.id), name, price ?? null, unit ?? null)
    res.json({ ok: true })
  } catch (err) {
    console.error('cooperations PUT error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
