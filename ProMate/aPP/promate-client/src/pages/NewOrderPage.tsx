import { Fragment, useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ordersApi, partsApi, formLogApi, cooperationLogApi, materialsApi, cooperationsApi, dialogApi } from '../services/api'
import type { Material, Cooperation } from '../services/api'

interface PartRow {
  _id:              string
  _db_id?:          number
  _compound_numer?: string  // numer_detalu złożenia-rodzica (tylko dla sub-detali)
  numer_detalu:     string
  nazwa_detalu:     string
  ilosc:            number
  material_id:      number | null
  kop1_id:          number | null
  kop2_id:          number | null
  kop3_id:          number | null
  pdf_path:         string
  dwg_path:         string
  stp_path:         string
}

function emptyRow(): PartRow {
  return {
    _id:          Math.random().toString(36).slice(2),
    numer_detalu: '',
    nazwa_detalu: '',
    ilosc:        1,
    material_id:  null,
    kop1_id:      null,
    kop2_id:      null,
    kop3_id:      null,
    pdf_path:     '',
    dwg_path:     '',
    stp_path:     '',
  }
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^"+|"+$/g, '').trim()
}

// "ga14_40040101-uchwyt_silow-t" → { numer_detalu: "ga14.40.04.01.01", nazwa_detalu: "uchwyt silow" }
function parsePdfStem(stem: string): { numer_detalu: string; nazwa_detalu: string } {
  const parts     = stem.split('-')
  const rawNumber = parts[0] ?? ''
  const rawName   = parts[1] ?? ''

  let numer_detalu = rawNumber
  const u = rawNumber.indexOf('_')
  if (u !== -1) {
    const prefix = rawNumber.slice(0, u)
    let rest     = rawNumber.slice(u + 1)
    let suffix   = ''
    if (rest.length > 0 && /[a-zA-Z]$/.test(rest)) {
      suffix = rest.slice(-1)
      rest   = rest.slice(0, -1)
    }
    if (/^\d+$/.test(rest) && rest.length > 0) {
      const pairs: string[] = []
      for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2))
      numer_detalu = `${prefix}.${pairs.join('.')}${suffix}`
    }
  }

  return { numer_detalu, nazwa_detalu: rawName.replace(/_/g, ' ') }
}

const TH: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  border: '1px solid #bfdbfe', background: '#dbeafe', color: '#1d4ed8',
  textAlign: 'center', position: 'sticky', top: 0, zIndex: 2,
}

const TD: React.CSSProperties = {
  padding: '3px 4px', border: '1px solid #e5e7eb', verticalAlign: 'middle',
}

const INPUT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
  background: 'transparent', fontSize: 14, padding: '4px 5px', fontFamily: 'inherit',
}

const SELECT_STYLE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
  background: 'transparent', fontSize: 14, padding: '3px 3px', fontFamily: 'inherit',
  cursor: 'pointer',
}


export default function NewOrderPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const isEditMode = location.pathname.includes('/edytuj/')

  const [rows, setRows] = useState<PartRow[]>([emptyRow()])
  const [orderId, setOrderId] = useState<number | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [cooperations, setCooperations] = useState<Cooperation[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [folderPath, setFolderPath] = useState('')
  const [excelPath, setExcelPath]   = useState('')
  const [terminWyk, setTerminWyk] = useState('')
  const [rodzaj, setRodzaj] = useState<'wew' | 'zew'>((location.state as { rodzaj?: 'wew' | 'zew' })?.rodzaj ?? 'wew')

  useEffect(() => {
    materialsApi.getAll().then(setMaterials).catch(() => {})
    cooperationsApi.getAll().then(setCooperations).catch(() => {})
  }, [])

  const decoded = orderNumber ? decodeURIComponent(orderNumber) : ''

  // Ładuj istniejące detale w trybie edycji
  useEffect(() => {
    if (!isEditMode || !decoded) return
    ;(async () => {
      try {
        const allOrders = await ordersApi.getAll()
        const order = allOrders.find(o => o.order_number === decoded)
        if (!order) return

        setOrderId(order.id)
        if (order.typ_zamowienia === 'wew' || order.typ_zamowienia === 'zew') {
          setRodzaj(order.typ_zamowienia)
        }

        const parts = await ordersApi.getParts(order.id)
        if (!parts.length) return

        const partIds = parts.map(p => p.id)

        const [paths, formLogs, coopLogs] = await Promise.all([
          partsApi.getPaths(partIds),
          formLogApi.getByPartIds(partIds),
          cooperationLogApi.getByPartIds(partIds),
        ])

        const pathMap = new Map(paths.map(p => [p.part_id, p]))
        const formMap = new Map(formLogs.map(f => [f.part_id, f]))
        const coopMap = new Map<number, Map<number, number | null>>()
        for (const cl of coopLogs) {
          if (!coopMap.has(cl.part_id)) coopMap.set(cl.part_id, new Map())
          coopMap.get(cl.part_id)!.set(cl.slot, cl.cooperation_id)
        }

        if (parts[0]?.deadline_at) {
          const iso = new Date(String(parts[0].deadline_at)).toISOString().split('T')[0]
          setTerminWyk(iso)
        }

        setRows(parts.map(p => {
          const path  = pathMap.get(p.id)
          const form  = formMap.get(p.id)
          const coops = coopMap.get(p.id)
          return {
            _id:          Math.random().toString(36).slice(2),
            _db_id:       p.id,
            numer_detalu: p.part_number,
            nazwa_detalu: p.name,
            ilosc:        p.quantity_right,
            material_id:  form?.material_est_id ?? null,
            kop1_id:      coops?.get(1) ?? null,
            kop2_id:      coops?.get(2) ?? null,
            kop3_id:      coops?.get(3) ?? null,
            pdf_path:     path?.PDF_path ?? '',
            dwg_path:     path?.DWG_path ?? '',
            stp_path:     path?.STP_path ?? '',
          }
        }))
      } catch (err) {
        console.error('Edit mode load error:', err)
      }
    })()
  }, [isEditMode, decoded])

  const update = (id: string, field: keyof PartRow, value: unknown) =>
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r))

  const removeRow = (id: string) =>
    setRows(prev => prev.length > 1 ? prev.filter(r => r._id !== id) : prev)

  const addRow = () => setRows(prev => [...prev, emptyRow()])

  const duplicatedNrs = new Set(
    rows.map(r => r.numer_detalu.trim().toLowerCase()).filter(
      (v, i, arr) => v && arr.indexOf(v) !== i
    )
  )

  const handleLoadFromExcel = async () => {
    const p = stripQuotes(excelPath)
    if (!p) return
    try {
      const { rows: excelRows } = await dialogApi.readExcel(p)
      if (!excelRows.length) return

      setRows(prev => prev.map(row => {
        const match = excelRows.find(
          er => er.numer_detalu.trim().toLowerCase() === row.numer_detalu.trim().toLowerCase()
        )
        if (!match) return row

        const material_id = match.material
          ? (materials.find(m => m.name.trim().toLowerCase() === match.material.trim().toLowerCase())?.id ?? row.material_id)
          : row.material_id

        const kop1_id = match.kop1
          ? (cooperations.find(c => c.name.trim().toLowerCase() === match.kop1.trim().toLowerCase())?.id ?? row.kop1_id)
          : row.kop1_id

        const kop2_id = match.kop2
          ? (cooperations.find(c => c.name.trim().toLowerCase() === match.kop2.trim().toLowerCase())?.id ?? row.kop2_id)
          : row.kop2_id

        return { ...row, material_id, kop1_id, kop2_id }
      }))
    } catch {}
  }

  const handleLoadFromFolder = async () => {
    const base = stripQuotes(folderPath)
    if (!base) return
    try {
      const { files } = await dialogApi.listPdfs(base)
      if (!files.length) { alert('Nie znaleziono plików PDF w podanym folderze.'); return }

      // Pierwszy przebieg: parsuj nazwy, buduj mapę rawKey → numer_detalu
      const keyToNumer = new Map<string, string>()
      const parsed = files.map(f => {
        const { numer_detalu, nazwa_detalu } = parsePdfStem(f.name)
        const rawKey = f.name.split('-')[0].toLowerCase()
        keyToNumer.set(rawKey, numer_detalu)
        return { numer_detalu, nazwa_detalu, pdf_path: f.pdf_path, dwg_path: f.dwg_path ?? '', stp_path: f.stp_path ?? '', compound_key: f.compound_key }
      })

      // Drugi przebieg: przypisz _compound_numer dla sub-detali złożeń
      setRows(parsed.map(p => ({
        ...emptyRow(),
        numer_detalu:     p.numer_detalu,
        nazwa_detalu:     p.nazwa_detalu,
        pdf_path:         p.pdf_path,
        dwg_path:         p.dwg_path,
        stp_path:         p.stp_path,
        _compound_numer:  p.compound_key ? (keyToNumer.get(p.compound_key) ?? undefined) : undefined,
      })))
    } catch (err) {
      alert(`Błąd wczytywania folderu:\n${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Wiersze z jakimikolwiek danymi (nie puste)
  const activeRows = rows.filter(r => r.numer_detalu.trim() || r.nazwa_detalu.trim())

  const validationErrors: string[] = []
  if (!terminWyk)
    validationErrors.push('Uzupełnij termin realizacji')
  if (activeRows.length === 0)
    validationErrors.push('Dodaj przynajmniej jeden detal')
  else if (activeRows.some(r => !r.numer_detalu.trim() || !r.nazwa_detalu.trim() || r.ilosc < 1))
    validationErrors.push('Każdy detal wymaga numeru, nazwy i ilości ≥ 1')
  if (duplicatedNrs.size > 0)
    validationErrors.push('Usuń zduplikowane numery detali')

  const canSave = validationErrors.length === 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)

    if (isEditMode) {
      try {
        const existingRows = activeRows.filter(r => r._db_id)
        const newRows      = activeRows.filter(r => !r._db_id)

        // Aktualizuj istniejące detale
        for (const row of existingRows) {
          const pn  = row.numer_detalu.trim()
          const name = row.nazwa_detalu.trim()
          const qty  = row.ilosc
          const dead = terminWyk || null
          const pdf  = stripQuotes(row.pdf_path) || null
          const dwg  = stripQuotes(row.dwg_path) || null
          const stp  = stripQuotes(row.stp_path) || null
          await partsApi.updateBasic(row._db_id!, { part_number: pn, name, quantity_right: qty, deadline_at: dead })
          await partsApi.updatePaths(row._db_id!, { PDF_path: pdf, DWG_path: dwg, STP_path: stp })
          await formLogApi.saveMaterialEst(row._db_id!, row.material_id)
          for (const [slot, kop_id] of [[1, row.kop1_id], [2, row.kop2_id], [3, row.kop3_id]] as [number, number | null][]) {
            await cooperationLogApi.save({ part_id: row._db_id!, cooperation_id: kop_id, slot })
          }
        }

        if (orderId !== null && newRows.length > 0) {
          // Mapa: numer_detalu → db_id — do rozwiązania compound_id dla sub-detali
          const newNumToId = new Map<string, number>()

          // Najpierw: złożenia i zwykłe detale (bez _compound_numer)
          for (const row of newRows.filter(r => !r._compound_numer)) {
            const pn  = row.numer_detalu.trim()
            const pdf = stripQuotes(row.pdf_path) || null
            const dwg = stripQuotes(row.dwg_path) || null
            const stp = stripQuotes(row.stp_path) || null
            const { id: partId } = await partsApi.create({ order_id: orderId, part_number: pn, name: row.nazwa_detalu.trim(), quantity_right: row.ilosc, deadline_at: terminWyk || null })
            newNumToId.set(pn, partId)
            if (pdf || dwg || stp) await partsApi.updatePaths(partId, { PDF_path: pdf, DWG_path: dwg, STP_path: stp })
            if (row.material_id) await formLogApi.saveMaterialEst(partId, row.material_id)
            for (const [slot, kop_id] of [[1, row.kop1_id], [2, row.kop2_id], [3, row.kop3_id]] as [number, number | null][]) {
              if (kop_id) await cooperationLogApi.save({ part_id: partId, cooperation_id: kop_id, slot })
            }
          }

          // Następnie: sub-detale złożeń (z _compound_numer)
          for (const row of newRows.filter(r => !!r._compound_numer)) {
            const pn  = row.numer_detalu.trim()
            const pdf = stripQuotes(row.pdf_path) || null
            const dwg = stripQuotes(row.dwg_path) || null
            const stp = stripQuotes(row.stp_path) || null
            // Szukaj compound_id wśród nowo dodanych lub istniejących detali
            const compoundId = newNumToId.get(row._compound_numer!)
              ?? existingRows.find(r => r.numer_detalu === row._compound_numer)?._db_id
              ?? null
            const { id: partId } = await partsApi.create({ order_id: orderId, part_number: pn, name: row.nazwa_detalu.trim(), quantity_right: row.ilosc, deadline_at: terminWyk || null, compound_id: compoundId })
            if (pdf || dwg || stp) await partsApi.updatePaths(partId, { PDF_path: pdf, DWG_path: dwg, STP_path: stp })
            if (row.material_id) await formLogApi.saveMaterialEst(partId, row.material_id)
            for (const [slot, kop_id] of [[1, row.kop1_id], [2, row.kop2_id], [3, row.kop3_id]] as [number, number | null][]) {
              if (kop_id) await cooperationLogApi.save({ part_id: partId, cooperation_id: kop_id, slot })
            }
          }
        }

        navigate(`/orders/${encodeURIComponent(decoded)}`)
      } catch {
        setSaveError('Błąd podczas zapisywania. Sprawdź dane i spróbuj ponownie.')
      } finally {
        setSaving(false)
      }
      return
    }

    try {
      await ordersApi.createFullOrder({
        order_number:   decoded,
        typ_zamowienia: rodzaj,
        parts: activeRows.map(row => ({
          part_number:          row.numer_detalu.trim(),
          name:                 row.nazwa_detalu.trim(),
          quantity_right:       row.ilosc,
          deadline_at:          terminWyk,
          pdf_path:             stripQuotes(row.pdf_path) || null,
          dwg_path:             stripQuotes(row.dwg_path) || null,
          stp_path:             stripQuotes(row.stp_path) || null,
          material_id:          row.material_id,
          kop1_id:              row.kop1_id,
          kop2_id:              row.kop2_id,
          kop3_id:              row.kop3_id,
          compound_part_number: row._compound_numer ?? null,
        })),
      })
      navigate(`/orders/${encodeURIComponent(decoded)}`)
    } catch {
      setSaveError('Błąd podczas zapisywania. Sprawdź dane i spróbuj ponownie.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>

      {/* ── Nagłówek ── */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>Termin wykonania:</span>
            <input
              type="date"
              value={terminWyk}
              onChange={e => setTerminWyk(e.target.value)}
              style={{
                border: terminWyk ? '1px solid #d1d5db' : '1px solid #ef4444',
                borderRadius: 5, padding: '3px 7px',
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
                background: terminWyk ? '#fff' : '#fef2f2',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>Rodzaj zamówienia:</span>
            <span style={{
              padding: '2px 12px', borderRadius: 5, fontSize: 13,
              background: '#1d4ed8', color: '#fff', fontWeight: 600,
            }}>
              {rodzaj}
            </span>
          </div>
          <span style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontWeight: 700, fontSize: 22, color: '#1f2937', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {decoded}
          </span>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 14, tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 46 }} />
            <col style={{ width: 173 }} />
            <col style={{ width: 199 }} />
            <col style={{ width: 51 }} />
            <col style={{ width: 148 }} />
            <col style={{ width: 129 }} />
            <col style={{ width: 129 }} />
            <col style={{ width: 129 }} />
            <col />
            <col style={{ width: 50 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 46 }} />
          </colgroup>

          <thead>
            <tr>
              {['Lp.', 'Numer Detalu', 'Nazwa Detalu',
                'Ilość', 'Materiał', 'Kop. 1', 'Kop. 2', 'Kop. 3', 'PDF', 'DWG', 'STP', ''].map((h, i) => (
                <th key={i} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const isDup = row.numer_detalu.trim() && duplicatedNrs.has(row.numer_detalu.trim().toLowerCase())
              const rowBg = isDup ? '#fee2e2' : i % 2 === 0 ? '#fff' : '#f8fafc'
              return (
                <Fragment key={row._id}>

                  {/* ── Wiersz danych ── */}
                  <tr style={{ background: rowBg }}>
                    {/* Lp. */}
                    <td style={{ ...TD, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>
                      {i + 1}
                    </td>
                    {/* Numer Detalu */}
                    <td style={{ ...TD, background: row.numer_detalu ? rowBg : '#fffbeb' }}>
                      <input
                        value={row.numer_detalu}
                        onChange={e => update(row._id, 'numer_detalu', e.target.value)}
                        placeholder="Nr detalu *"
                        style={{ ...INPUT, color: row.numer_detalu ? '#111' : '#9ca3af' }}
                      />
                    </td>
                    {/* Nazwa Detalu */}
                    <td style={{ ...TD, background: row.nazwa_detalu ? rowBg : '#fffbeb' }}>
                      <input
                        value={row.nazwa_detalu}
                        onChange={e => update(row._id, 'nazwa_detalu', e.target.value)}
                        placeholder="Nazwa *"
                        style={{ ...INPUT, color: row.nazwa_detalu ? '#111' : '#9ca3af' }}
                      />
                    </td>
                    {/* Ilość */}
                    <td style={{ ...TD, background: row.ilosc >= 1 ? rowBg : '#fef2f2' }}>
                      <input
                        type="number"
                        value={row.ilosc || ''}
                        onChange={e => update(row._id, 'ilosc', e.target.value === '' ? 0 : Number(e.target.value))}
                        onBlur={e => { if (!e.target.value || Number(e.target.value) < 1) update(row._id, 'ilosc', 1) }}
                        style={{ ...INPUT, textAlign: 'center' }}
                      />
                    </td>
                    {/* Materiał */}
                    <td style={TD}>
                      <select
                        value={row.material_id ?? ''}
                        onChange={e => update(row._id, 'material_id', e.target.value ? Number(e.target.value) : null)}
                        style={SELECT_STYLE}
                      >
                        <option value="">—</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                    {/* Kop 1, 2, 3 */}
                    {(['kop1_id', 'kop2_id', 'kop3_id'] as const).map(field => (
                      <td key={field} style={TD}>
                        <select
                          value={row[field] ?? ''}
                          onChange={e => update(row._id, field, e.target.value ? Number(e.target.value) : null)}
                          style={SELECT_STYLE}
                        >
                          <option value="">—</option>
                          {cooperations.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                    {/* Ścieżka PDF */}
                    <td style={{ ...TD, padding: '3px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>PDF</span>
                        <input
                          value={row.pdf_path}
                          onChange={e => update(row._id, 'pdf_path', e.target.value)}
                          onBlur={e => {
                            const stripped = stripQuotes(e.target.value)
                            if (stripped !== row.pdf_path) update(row._id, 'pdf_path', stripped)
                          }}
                          placeholder="Ścieżka PDF..."
                          style={{
                            flex: 1, border: 'none', borderBottom: '1px solid #fecaca',
                            outline: 'none', background: 'transparent',
                            fontSize: 12, color: '#374151', padding: '2px 0', fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    </td>
                    {/* DWG — ikonka */}
                    <td style={{ ...TD, textAlign: 'center' }}>
                      {row.dwg_path
                        ? <span title={row.dwg_path} style={{ fontSize: 15, color: '#2563eb', cursor: 'default' }}>✔</span>
                        : <span style={{ fontSize: 13, color: '#d1d5db' }}>—</span>
                      }
                    </td>
                    {/* STP — ikonka */}
                    <td style={{ ...TD, textAlign: 'center' }}>
                      {row.stp_path
                        ? <span title={row.stp_path} style={{ fontSize: 15, color: '#16a34a', cursor: 'default' }}>✔</span>
                        : <span style={{ fontSize: 13, color: '#d1d5db' }}>—</span>
                      }
                    </td>
                    {/* Usuń */}
                    <td style={{ ...TD, textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        onClick={() => removeRow(row._id)}
                        title="Usuń detal"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#dc2626', fontSize: 13, padding: '2px 4px', lineHeight: 1,
                          opacity: rows.length === 1 ? 0.2 : 0.6,
                        }}
                        disabled={rows.length === 1}
                      >✕</button>
                    </td>
                  </tr>

                </Fragment>
              )
            })}
          </tbody>
        </table>

        {/* Dodaj detal */}
        <button
          onClick={addRow}
          style={{
            marginTop: 0, width: '100%',
            background: 'none', border: '1px dashed #93c5fd', borderRadius: 0,
            padding: '7px 0', fontSize: 12, color: '#1d4ed8', cursor: 'pointer',
          }}
        >
          + Dodaj detal
        </button>
      </div>

      {/* ── Panel folderu + Excela ── */}
      <div style={{ flexShrink: 0, background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
        {/* Folder */}
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
            Ścieżka folderu:
          </span>
          <input
            value={folderPath}
            onChange={e => setFolderPath(e.target.value)}
            onBlur={e => setFolderPath(stripQuotes(e.target.value))}
            placeholder='np. C:\Users\...\252001-GA14-64'
            style={{
              flex: 1, border: '1px solid #d1d5db', borderRadius: 6,
              padding: '6px 10px', fontSize: 12, outline: 'none',
              background: '#fff', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleLoadFromFolder}
            disabled={!folderPath.trim()}
            style={{
              padding: '6px 16px', border: 'none', borderRadius: 6,
              background: folderPath.trim() ? '#0369a1' : '#bae6fd',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: folderPath.trim() ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            Załaduj pliki
          </button>
        </div>
        {/* Excel */}
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
            Ścieżka Excela:
          </span>
          <input
            value={excelPath}
            onChange={e => setExcelPath(e.target.value)}
            onBlur={e => setExcelPath(stripQuotes(e.target.value))}
            placeholder='np. C:\Users\...\Zamówienia.xlsx'
            style={{
              flex: 1, border: '1px solid #d1d5db', borderRadius: 6,
              padding: '6px 10px', fontSize: 12, outline: 'none',
              background: '#fff', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleLoadFromExcel}
            disabled={!excelPath.trim()}
            style={{
              padding: '6px 16px', border: 'none', borderRadius: 6,
              background: excelPath.trim() ? '#15803d' : '#bbf7d0',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: excelPath.trim() ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            Załaduj Excel
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        flexShrink: 0, background: '#fff', borderTop: '2px solid #e5e7eb',
        padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        {/* Lewa strona — Anuluj / Usuń zamówienie (tylko tryb edycji) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isEditMode && orderId !== null && (<>
            {/* Anuluj zamówienie */}
            {!cancelConfirm ? (
              <button
                onClick={() => { setDeleteConfirm(false); setCancelConfirm(true) }}
                style={{
                  padding: '8px 16px', border: '1px solid #fca5a5', borderRadius: 6,
                  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#dc2626', fontWeight: 600,
                }}
              >
                Anuluj zamówienie
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Czy na pewno anulować zamówienie?</span>
                <button
                  disabled={cancelling}
                  onClick={async () => {
                    setCancelling(true)
                    try {
                      await ordersApi.cancelOrder(orderId)
                      navigate('/orders')
                    } catch { /* ignoruj */ } finally {
                      setCancelling(false)
                    }
                  }}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 600,
                    background: '#dc2626', color: '#fff', border: 'none',
                    borderRadius: 5, cursor: cancelling ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelling ? '...' : 'Tak, anuluj'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  style={{
                    padding: '4px 10px', fontSize: 12, fontWeight: 500,
                    background: '#fff', color: '#6b7280', border: '1px solid #d1d5db',
                    borderRadius: 5, cursor: 'pointer',
                  }}
                >
                  Nie
                </button>
              </div>
            )}

            {/* Usuń zamówienie */}
            {!cancelConfirm && (!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                style={{
                  padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6,
                  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280', fontWeight: 600,
                }}
              >
                Usuń zamówienie
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>Czy na pewno usunąć zamówienie i wszystkie detale?</span>
                <button
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true)
                    try {
                      await ordersApi.deleteOrder(orderId)
                      navigate('/orders')
                    } catch { /* ignoruj */ } finally {
                      setDeleting(false)
                    }
                  }}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 600,
                    background: '#374151', color: '#fff', border: 'none',
                    borderRadius: 5, cursor: deleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {deleting ? '...' : 'Tak, usuń'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    padding: '4px 10px', fontSize: 12, fontWeight: 500,
                    background: '#fff', color: '#6b7280', border: '1px solid #d1d5db',
                    borderRadius: 5, cursor: 'pointer',
                  }}
                >
                  Nie
                </button>
              </div>
            ))}
          </>)}
        </div>

        {/* Prawa strona — błędy + Anuluj + Zapisz */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {saveError && (
          <span style={{ fontSize: 12, color: '#dc2626', marginRight: 8 }}>{saveError}</span>
        )}
        {!canSave && !saveError && (
          <span style={{ fontSize: 12, color: '#dc2626', marginRight: 8 }}>
            {validationErrors[0]}
          </span>
        )}
        <button
          onClick={() => navigate('/orders')}
          style={{
            padding: '8px 20px', border: '1px solid #d1d5db', borderRadius: 6,
            background: '#f9fafb', fontSize: 13, cursor: 'pointer', color: '#374151',
          }}
        >
          Anuluj
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          title={!canSave ? validationErrors.join(' • ') : undefined}
          style={{
            padding: '8px 28px', border: 'none', borderRadius: 6,
            background: saving ? '#93c5fd' : !canSave ? '#9ca3af' : '#1d4ed8',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: saving || !canSave ? 'default' : 'pointer',
            opacity: !canSave ? 0.7 : 1,
          }}
        >
          {saving ? 'Zapisywanie...' : isEditMode ? 'Zapisz zmiany' : 'Zapisz zamówienie'}
        </button>
        </div>
      </div>

    </div>
  )
}
