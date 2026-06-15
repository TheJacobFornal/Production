import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { getDb, closeDb } from '../config/database'

const app = createApp()

// Sprawdź połączenie z bazą przed testami
beforeAll(async () => {
  const db = await getDb()
  await db.request().query('SELECT 1 AS ok')
}, 15000) // 15s timeout na połączenie

afterAll(async () => {
  await closeDb()
})

// ─── GET /api/orders ────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  it('zwraca listę zamówień', async () => {
    const res = await request(app).get('/api/orders')
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(Array)
    expect(res.body.length).toBeGreaterThanOrEqual(2)
  })

  it('każde zamówienie ma wymagane pola', async () => {
    const res = await request(app).get('/api/orders')
    res.body.forEach((order: { id: unknown; order_number: unknown }) => {
      expect(order).toHaveProperty('id')
      expect(order).toHaveProperty('order_number')
    })
  })
})

// ─── GET /api/orders/:id ────────────────────────────────────────────────────

describe('GET /api/orders/:id', () => {
  it('zwraca zamówienie po id', async () => {
    const res = await request(app).get('/api/orders/1')
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.order_number).toBe('ZAM-2024-001')
  })

  it('zwraca 404 dla nieistniejącego id', async () => {
    const res = await request(app).get('/api/orders/9999')
    expect(res.status).toBe(404)
  })
})

// ─── GET /api/orders/:id/parts ──────────────────────────────────────────────

describe('GET /api/orders/:id/parts', () => {
  it('zwraca detale zamówienia 1', async () => {
    const res = await request(app).get('/api/orders/1/parts')
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(Array)
    expect(res.body.length).toBe(2) // 2 części w seed
  })

  it('zwraca detale zamówienia 2', async () => {
    const res = await request(app).get('/api/orders/2/parts')
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1) // 1 część w seed
  })
})

// ─── GET /api/orders/search/:orderNumber ────────────────────────────────────

describe('GET /api/orders/search/:orderNumber', () => {
  it('zwraca podsumowanie zamówienia', async () => {
    const res = await request(app).get('/api/orders/search/ZAM-2024-001')
    expect(res.status).toBe(200)
    expect(res.body.order_number).toBe('ZAM-2024-001')
    expect(res.body.parts_count).toBe(2)
  })

  it('zwraca 404 dla nieistniejącego numeru', async () => {
    const res = await request(app).get('/api/orders/search/NIEISTNIEJACY')
    expect(res.status).toBe(404)
  })
})

// ─── GET /api/health ────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('zwraca status ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
