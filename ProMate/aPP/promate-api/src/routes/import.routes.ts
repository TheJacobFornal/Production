import { Router } from 'express'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const router = Router()

router.post('/run', (req, res) => {
  // __dirname = promate-api/dist/routes/ → ../../../ = aPP/
  const exePath = process.env.PROMATE_IMPORT_EXE
    ?? path.join(__dirname, '../../../promate-import/dist/ProMate_DailyOnce.exe')

  if (!fs.existsSync(exePath)) {
    res.json({ added: -1, error: `Nie znaleziono pliku exe: ${exePath}` })
    return
  }

  let output = ''
  let finished = false

  const child = spawn(exePath, [], {
    windowsHide: true,
    cwd: path.dirname(exePath),
  })

  child.stdout.on('data', (data: Buffer) => { output += data.toString() })
  child.stderr.on('data', (data: Buffer) => { output += data.toString() })

  child.on('close', (code: number | null) => {
    if (finished) return
    finished = true
    const match = output.match(/PROMATE_ADDED:\s*(\d+)/)
    const added = match ? parseInt(match[1], 10) : 0
    res.json({ added, exitCode: code ?? 0, output, exePath })
  })

  child.on('error', (err: Error) => {
    if (finished) return
    finished = true
    res.json({ added: -1, error: err.message, output, exePath })
  })
})

export default router
