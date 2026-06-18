import { Router } from 'express'
import { formLogRepository } from '../repositories/form-log.repository'

const router = Router()

// POST /api/form-log/dims — upsert wymiarów
router.post('/dims', async (req, res) => {
  try {
    const { part_id, dim_a_est, dim_b_est, dim_c_est } = req.body
    if (!part_id) return res.status(400).json({ message: 'part_id wymagane' })
    await formLogRepository.upsertDims(
      Number(part_id),
      dim_a_est != null ? Number(dim_a_est) : null,
      dim_b_est != null ? Number(dim_b_est) : null,
      dim_c_est != null ? Number(dim_c_est) : null,
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('form-log POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// POST /api/form-log/real — upsert rzeczywistych wymiarów, masy, pow. i materiału
router.post('/real', async (req, res) => {
  try {
    const { part_id, dim_a_real, dim_b_real, dim_c_real, material_id, weight_one, area_one } = req.body
    if (!part_id) return res.status(400).json({ message: 'part_id wymagane' })
    const n = (v: unknown) => (v != null && v !== '' ? Number(v) : null)
    await formLogRepository.upsertReal(
      Number(part_id), n(dim_a_real), n(dim_b_real), n(dim_c_real),
      n(material_id), n(weight_one), n(area_one),
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('form-log/real POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})


// PATCH /api/form-log/material-est — zapis materiału szacunkowego
router.patch('/material-est', async (req, res) => {
  try {
    const { part_id, material_est_id } = req.body
    if (!part_id) return res.status(400).json({ message: 'part_id wymagane' })
    const val = material_est_id != null && material_est_id !== '' ? Number(material_est_id) : null
    await formLogRepository.upsertMaterialEst(Number(part_id), val)
    res.json({ ok: true })
  } catch (err) {
    console.error('form-log/material-est PATCH error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// PATCH /api/form-log/cost-kit — zapis ceny materiału kpl
router.patch('/cost-kit', async (req, res) => {
  try {
    const { part_id, cost_kit } = req.body
    if (!part_id) return res.status(400).json({ message: 'part_id wymagane' })
    const val = cost_kit != null && cost_kit !== '' ? Number(cost_kit) : null
    await formLogRepository.updateCostKit(Number(part_id), val)
    res.json({ ok: true })
  } catch (err) {
    console.error('form-log/cost-kit PATCH error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/form-log?partIds=1,2,3
router.get('/', async (req, res) => {
  try {
    const raw = req.query.partIds as string | undefined
    if (!raw) return res.json([])
    const ids = raw.split(',').map(Number).filter(Boolean)
    const logs = await formLogRepository.getByPartIds(ids)
    res.json(logs)
  } catch (err) {
    console.error('form-log GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
