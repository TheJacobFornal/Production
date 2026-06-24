import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

// GET /api/file?path=C:\...\file.pdf
// Streams a local file by absolute path — for local network use only
router.get('/', (req: Request, res: Response) => {
  const filePath = req.query.path as string | undefined
  if (!filePath) return res.status(400).json({ message: 'Brak parametru path' })

  const abs = path.resolve(filePath)
  if (!fs.existsSync(abs)) return res.status(404).json({ message: 'Plik nie istnieje' })
  if (fs.statSync(abs).isDirectory()) return res.status(400).json({ message: 'Ścieżka wskazuje na folder, nie plik' })

  const ext = path.extname(abs).toLowerCase()
  const mime =
    ext === '.pdf'  ? 'application/pdf' :
    ext === '.dwg'  ? 'application/acad' :
    ext === '.stp' || ext === '.step' ? 'application/step' :
    'application/octet-stream'

  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Disposition', 'inline')
  fs.createReadStream(abs).pipe(res)
})

export default router
