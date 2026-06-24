import { Router } from 'express'
import { orderRepository } from '../repositories/orders.repository'
import { generateMergedPdfsForOrder, listPrinters } from '../services/card-pdf.service'

const router = Router()

// GET /api/orders
router.get('/', async (_req, res) => {
  const orders = await orderRepository.getAll()
  res.json(orders)
})

// GET /api/orders/summary  ← musi być PRZED /:id
router.get('/summary', async (_req, res) => {
  const orders = await orderRepository.getAllSummary()
  res.json(orders)
})

// GET /api/orders/search/:orderNumber  ← musi być PRZED /:id
router.get('/search/:orderNumber', async (req, res) => {
  const summary = await orderRepository.getSummaryByOrderNumber(req.params.orderNumber)
  if (!summary) return res.status(404).json({ message: 'Nie znaleziono zamówienia' })
  res.json(summary)
})

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const order = await orderRepository.getById(Number(req.params.id))
  if (!order) return res.status(404).json({ message: 'Nie znaleziono zamówienia' })
  res.json(order)
})

// GET /api/orders/:id/parts?minPhase=D3
router.get('/:id/parts', async (req, res) => {
  const minPhase = req.query.minPhase as string | undefined
  const maxPhase = req.query.maxPhase as string | undefined
  const parts = await orderRepository.getParts(Number(req.params.id), minPhase, maxPhase)
  res.json(parts)
})

// GET /api/orders/printers
router.get('/printers', async (_req, res) => {
  try {
    const printers = await listPrinters()
    res.json({ printers })
  } catch (err) {
    res.status(500).json({ message: String(err) })
  }
})

// POST /api/orders/:id/ready-for-production
router.post('/:id/ready-for-production', async (req, res) => {
  try {
    const orderId = Number(req.params.id)
    const printer: string | undefined = req.body?.printer || undefined
    const { errors } = await generateMergedPdfsForOrder(orderId, printer)
    await orderRepository.readyForProduction(orderId)
    res.json({ ok: true, pdfErrors: errors.length > 0 ? errors : undefined })
  } catch (err) {
    console.error('ready-for-production error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
