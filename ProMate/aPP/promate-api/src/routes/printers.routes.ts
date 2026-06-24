import { Router } from 'express'
import { exec } from 'child_process'

const router = Router()

router.get('/', (_req, res) => {
  exec('wmic printer get Name', { timeout: 5000 }, (error, stdout) => {
    if (error) return res.json([])
    const printers = stdout
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && l !== 'Name')
      .sort()
    res.json(printers)
  })
})

export default router
