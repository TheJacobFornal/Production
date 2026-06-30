import { Router } from 'express'
import { exec }   from 'child_process'
import os   from 'os'
import path from 'path'
import fs   from 'fs'
import * as XLSX from 'xlsx'

const router = Router()

// Nowoczesny IFileOpenDialog z Windows Shell API (Vista+), tryb wyboru folderu
const PS_SCRIPT = `
Add-Type @'
using System;
using System.Runtime.InteropServices;

public class ModernFolderPicker
{
    [ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileDialog
    {
        [PreserveSig] int Show(IntPtr hwndOwner);
        void SetFileTypes(uint c, IntPtr specs);
        void SetFileTypeIndex(uint i);
        void GetFileTypeIndex(out uint i);
        void Advise(IntPtr pfde, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint fos);
        void GetOptions(out uint fos);
        void SetDefaultFolder([MarshalAs(UnmanagedType.Interface)] object psi);
        void SetFolder([MarshalAs(UnmanagedType.Interface)] object psi);
        void GetFolder([MarshalAs(UnmanagedType.Interface)] out object ppsi);
        void GetCurrentSelection([MarshalAs(UnmanagedType.Interface)] out object ppsi);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetResult([MarshalAs(UnmanagedType.Interface)] out object ppsi);
        void AddPlace([MarshalAs(UnmanagedType.Interface)] object psi, uint fdap);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string ext);
        void Close(int hr);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter([MarshalAs(UnmanagedType.Interface)] object filter);
    }

    [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem
    {
        void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
        void GetParent([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
        void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
        void GetAttributes(uint mask, out uint attribs);
        void Compare([MarshalAs(UnmanagedType.Interface)] IShellItem psi, uint hint, out int order);
    }

    [ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
    private class FileOpenDialogCOM {}

    public static string Pick(string title)
    {
        try {
            var dlg = (IFileDialog)(new FileOpenDialogCOM());
            dlg.SetOptions(0x00000020 | 0x00000040); // FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM
            dlg.SetTitle(title);
            dlg.SetOkButtonLabel("Wybierz");
            int hr = dlg.Show(IntPtr.Zero);
            if (hr != 0) return null;
            object item;
            dlg.GetResult(out item);
            string p;
            ((IShellItem)item).GetDisplayName(0x80058000, out p); // SIGDN_FILESYSPATH
            return p;
        } catch { return null; }
    }
}
'@
$r = [ModernFolderPicker]::Pick("Wybierz folder z rysunkami")
if ($r) { Write-Output $r }
`.trimStart()

// GET /api/dialog/select-folder
router.get('/select-folder', (req, res) => {
  const tmpFile = path.join(os.tmpdir(), `promate_pick_${Date.now()}.ps1`)

  try {
    fs.writeFileSync(tmpFile, PS_SCRIPT, 'utf8')
  } catch {
    return res.status(500).json({ path: null })
  }

  exec(
    `powershell -STA -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${tmpFile}"`,
    { timeout: 120_000 },
    (err, stdout) => {
      try { fs.unlinkSync(tmpFile) } catch {}
      const selected = stdout.trim()
      res.json({ path: selected || null })
    },
  )
})

// GET /api/dialog/select-file?ext=.pdf&initialDir=C:\path
router.get('/select-file', (req, res) => {
  const ext        = ((req.query.ext as string) || '.pdf').toLowerCase()
  const initialDir = ((req.query.initialDir as string) || '').replace(/"/g, "'")
  const label      = ext.replace('.', '').toUpperCase()
  const initLine   = initialDir ? `$d.InitialDirectory = "${initialDir}"` : ''
  const script     = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title  = "Wybierz plik ${label}"
$d.Filter = "${label} (*${ext})|*${ext}|Wszystkie pliki (*.*)|*.*"
${initLine}
if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName }
`.trimStart()
  const tmp = path.join(os.tmpdir(), `promate_file_${Date.now()}.ps1`)
  try { fs.writeFileSync(tmp, script, 'utf8') } catch { return res.status(500).json({ path: null }) }
  exec(`powershell -STA -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${tmp}"`, { timeout: 120_000 }, (_err, stdout) => {
    try { fs.unlinkSync(tmp) } catch {}
    res.json({ path: stdout.trim() || null })
  })
})

// Zwraca blok cyfr z klucza pliku (np. "ga14_80020100a" → "80020100")
function extractDigitBlock(stem: string): string {
  const part0 = stem.toLowerCase().split('-')[0]
  const u = part0.indexOf('_')
  if (u === -1) return ''
  let rest = part0.slice(u + 1)
  if (/[a-z]$/.test(rest)) rest = rest.slice(0, -1)
  return /^\d+$/.test(rest) ? rest : ''
}

// Złożenie = ostatnie 2 cyfry numeru to "00"
function looksLikeCompound(stem: string): boolean {
  const d = extractDigitBlock(stem)
  return d.length >= 2 && d.endsWith('00')
}

// GET /api/dialog/list-pdfs?folder=...
// Dla każdego PDF wyciąga klucz = część przed pierwszym "-" (np. "gc010_06040001c").
// DWG/STP dopasowuje przez contains(klucz) — reszta nazwy pliku nie ma znaczenia.
// Podfolery będące złożeniami (klucz kończy się na "00") są skanowane rekurencyjnie;
// sub-detale otrzymują compound_key wskazujący na klucz złożenia.
router.get('/list-pdfs', (req, res) => {
  const rawFolder = ((req.query.folder as string) || '').trim().replace(/^"+|"+$/g, '').trim()
  if (!rawFolder) return res.json({ files: [] })

  type FileEntry = {
    name:         string
    pdf_path:     string
    dwg_path:     string | null
    stp_path:     string | null
    compound_key: string | null
  }

  function scanDir(dir: string, compoundKey: string | null): FileEntry[] {
    const ents    = fs.readdirSync(dir, { withFileTypes: true })
    const all     = ents.filter(e => e.isFile()).map(e => ({
      stem: path.basename(e.name, path.extname(e.name)),
      ext:  path.extname(e.name).toLowerCase(),
      full: path.join(dir, e.name),
    }))
    const pdfs = all.filter(f => f.ext === '.pdf')
    const dwgs = all.filter(f => f.ext === '.dwg')
    const stps = all.filter(f => f.ext === '.stp' || f.ext === '.step')
    return pdfs.map(pdf => {
      const key = pdf.stem.split('-')[0].toLowerCase()
      const dwg = dwgs.find(f => f.stem.toLowerCase().includes(key))
      const stp = stps.find(f => f.stem.toLowerCase().includes(key))
      return {
        name:         pdf.stem,
        pdf_path:     pdf.full,
        dwg_path:     dwg?.full ?? null,
        stp_path:     stp?.full ?? null,
        compound_key: (compoundKey && !looksLikeCompound(pdf.stem)) ? compoundKey : null,
      }
    })
  }

  try {
    if (!fs.existsSync(rawFolder)) return res.status(400).json({ message: `Folder nie istnieje: ${rawFolder}` })

    const entries = fs.readdirSync(rawFolder, { withFileTypes: true })

    // Zwykłe pliki bezpośrednio w folderze
    const regularFiles = scanDir(rawFolder, null)

    // Podfoldery będące złożeniami
    const compoundFiles: FileEntry[] = []
    for (const ent of entries.filter(e => e.isDirectory() && looksLikeCompound(e.name))) {
      const subDir  = path.join(rawFolder, ent.name)
      const subPdfs = fs.readdirSync(subDir, { withFileTypes: true })
        .filter(e => e.isFile() && path.extname(e.name).toLowerCase() === '.pdf')
      const compoundPdf = subPdfs.find(e =>
        looksLikeCompound(path.basename(e.name, path.extname(e.name)))
      )
      const compoundKey = compoundPdf
        ? path.basename(compoundPdf.name, path.extname(compoundPdf.name)).split('-')[0].toLowerCase()
        : null
      compoundFiles.push(...scanDir(subDir, compoundKey))
    }

    res.json({ files: [...regularFiles, ...compoundFiles] })
  } catch {
    res.json({ files: [] })
  }
})

// GET /api/dialog/read-excel?path=...
// Szuka w kol. B nagłówka "Numer detalu", zwraca wiersze: B=numer_detalu, F=material, G=kop1, H=kop2
router.get('/read-excel', (req, res) => {
  const rawPath = ((req.query.path as string) || '').trim().replace(/^"+|"+$/g, '').trim()
  if (!rawPath) return res.json({ rows: [] })
  try {
    if (!fs.existsSync(rawPath)) return res.status(404).json({ message: 'Plik nie istnieje' })
    const wb   = XLSX.readFile(rawPath)
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const all  = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null })

    const headerIdx = all.findIndex((row: (string | number | null)[]) => String(row[1] ?? '').toLowerCase().includes('numer detalu'))
    if (headerIdx === -1) return res.json({ rows: [] })

    const rows: { numer_detalu: string; material: string; kop1: string; kop2: string }[] = []
    for (let i = headerIdx + 1; i < all.length; i++) {
      const r = all[i]
      const numer = String(r[1] ?? '').trim()
      if (!numer) continue
      rows.push({
        numer_detalu: numer,
        material:     String(r[5] ?? '').trim(),
        kop1:         String(r[6] ?? '').trim(),
        kop2:         String(r[7] ?? '').trim(),
      })
    }
    res.json({ rows })
  } catch (err) {
    console.error('read-excel error:', err)
    res.status(500).json({ message: String(err) })
  }
})

// POST /api/dialog/open-folder  { path: string }
router.post('/open-folder', (req, res) => {
  const folderPath = req.body?.path as string
  if (!folderPath) return res.status(400).json({ ok: false })
  exec(`explorer "${folderPath}"`)
  res.json({ ok: true })
})

export default router
