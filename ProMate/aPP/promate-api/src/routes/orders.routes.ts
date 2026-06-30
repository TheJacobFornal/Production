import { Router } from 'express'
import { orderRepository } from '../repositories/orders.repository'
import { generateMergedPdfsForOrder, listPrinters } from '../services/card-pdf.service'

const router = Router()

// GET /api/orders
router.get('/', async (_req, res) => {
  const orders = await orderRepository.getAll()
  res.json(orders)
})

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { order_number, typ_zamowienia } = req.body
    if (!order_number?.trim()) return res.status(400).json({ message: 'Brak numeru zamówienia' })
    const id = await orderRepository.createOrder(order_number.trim(), typ_zamowienia ?? undefined)
    res.json({ id })
  } catch (err) {
    console.error('create-order error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// POST /api/orders/full  ← musi być PRZED /:id
router.post('/full', async (req, res) => {
  try {
    const { order_number, typ_zamowienia, parts } = req.body
    if (!order_number?.trim()) return res.status(400).json({ message: 'Brak numeru zamówienia' })
    if (!Array.isArray(parts) || !parts.length) return res.status(400).json({ message: 'Brak detali' })
    const id = await orderRepository.createFullOrder({
      order_number:   order_number.trim(),
      typ_zamowienia: typ_zamowienia ?? null,
      parts,
    })
    res.json({ id })
  } catch (err) {
    console.error('create-full-order error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
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

// POST /api/orders/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    await orderRepository.cancelOrder(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('cancel-order error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

// DELETE /api/orders/:id
router.delete('/:id', async (req, res) => {
  try {
    await orderRepository.deleteOrder(Number(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('delete-order error:', err)
    res.status(500).json({ message: 'Błąd serwera' })
  }
})

export default router
