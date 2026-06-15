import { Router } from 'express'
import { materialsRepository } from '../repositories/materials.repository'

const router = Router()

router.get('/', async (_req, res) => {
  const materials = await materialsRepository.getAll()
  res.json(materials)
})

export default router
