import { Router, Request, Response } from 'express'
import { usersRepository } from '../repositories/users.repository'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await usersRepository.getAll())
  } catch (err) {
    console.error('[users GET]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/positions', async (_req: Request, res: Response) => {
  try {
    res.json(await usersRepository.getPositions())
  } catch (err) {
    console.error('[positions GET]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const { name, surname, email, position_id } = req.body
  if (!name?.trim() || !surname?.trim()) {
    return res.status(400).json({ error: 'Imię i nazwisko są wymagane' })
  }
  try {
    const user = await usersRepository.create({ name: name.trim(), surname: surname.trim(), email: email ?? null, position_id: position_id ?? null })
    res.status(201).json(user)
  } catch (err) {
    console.error('[users POST]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Nieprawidłowe ID' })
  try {
    await usersRepository.update(id, req.body)
    res.json({ ok: true })
  } catch (err) {
    console.error('[users PATCH]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:id/settings', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Nieprawidłowe ID' })
  try {
    res.json(await usersRepository.getSettings(id))
  } catch (err) {
    console.error('[users GET settings]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/:id/settings', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'Nieprawidłowe ID' })
  try {
    await usersRepository.saveSettings(id, req.body)
    res.json({ ok: true })
  } catch (err) {
    console.error('[users PATCH settings]', err)
    res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
