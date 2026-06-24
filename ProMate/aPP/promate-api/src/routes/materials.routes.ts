import { Router } from 'express'
import { materialsRepository } from '../repositories/materials.repository'

const router = Router()

router.get('/', async (_req, res) => {
  const materials = await materialsRepository.getAll()
  res.json(materials)
})

router.post('/', async (req, res) => {
  try {
    const { name, density, cost } = req.body
    if (!name) return res.status(400).json({ message: 'name wymagane' })
    const id = await materialsRepository.upsert(null, name, density ?? null, cost ?? null)
    res.json({ id })
  } catch (err) {
    console.error('materials POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, density, cost } = req.body
    if (!name) return res.status(400).json({ message: 'name wymagane' })
    await materialsRepository.upsert(Number(req.params.id), name, density ?? null, cost ?? null)
    res.json({ ok: true })
  } catch (err) {
    console.error('materials PUT error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
