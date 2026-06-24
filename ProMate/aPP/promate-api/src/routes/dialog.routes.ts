import { Router } from 'express'
import { exec }   from 'child_process'
import os   from 'os'
import path from 'path'
import fs   from 'fs'

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

// POST /api/dialog/open-folder  { path: string }
router.post('/open-folder', (req, res) => {
  const folderPath = req.body?.path as string
  if (!folderPath) return res.status(400).json({ ok: false })
  exec(`explorer "${folderPath}"`)
  res.json({ ok: true })
})

export default router
