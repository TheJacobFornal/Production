import { Router } from 'express'
import { priceRepository } from '../repositories/price.repository'

const router = Router()

// POST /api/price — upsert kosztów/cen dla detalu
router.post('/', async (req, res) => {
  try {
    const { part_id, cost_commercial_kit, cost_labor_hour, cost_cooperation, cost_machining, price_kit, price_piece } = req.body
    if (!part_id) return res.status(400).json({ message: 'part_id wymagane' })
    const n = (v: unknown) => (v != null && v !== '' ? Number(v) : null)
    await priceRepository.upsert(
      Number(part_id),
      n(cost_commercial_kit),
      n(cost_labor_hour),
      n(cost_cooperation),
      n(cost_machining),
      n(price_kit),
      n(price_piece),
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('price POST error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// GET /api/price?partIds=1,2,3
router.get('/', async (req, res) => {
  try {
    const raw = req.query.partIds as string | undefined
    if (!raw) return res.json([])
    const ids = raw.split(',').map(Number).filter(Boolean)
    const prices = await priceRepository.getByPartIds(ids)
    res.json(prices)
  } catch (err) {
    console.error('price GET error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
