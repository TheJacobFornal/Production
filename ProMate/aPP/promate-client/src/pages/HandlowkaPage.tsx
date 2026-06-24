import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { commercialApi, CommercialPart } from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'Do zamówienia' | 'Zamówione' | 'Dotarło'
type SortKey = keyof Omit<HandlowkaRow, 'commercial_id'>
type SortDir = 'asc' | 'desc'

interface HandlowkaRow {
  commercial_id:    number
  part_id:          number
  numer_zlecenia:   string
  nr_detalu:        string
  ilosc:            number
  data_zamowienia:  string | null
  data_dostawy:     string | null
  status:           Status
}

const STATUS_FROM_NUM: Record<0 | 1 | 2, Status> = {
  0: 'Do zamówienia',
  1: 'Zamówione',
  2: 'Dotarło',
}

function toRow(p: CommercialPart): HandlowkaRow {
  return {
    commercial_id:   p.commercial_id,
    part_id:         p.part_id,
    numer_zlecenia:  p.numer_zlecenia,
    nr_detalu:       p.nr_detalu,
    ilosc:           p.ilosc,
    data_zamowienia: p.data_zamowienia,
    data_dostawy:    p.data_dostawy,
    status:          STATUS_FROM_NUM[p.status_num],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toDateInput(d: string | null): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

function isoToDisplay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function displayToIso(text: string): string | null {
  const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

interface DateInputProps {
  value: string | null
  onSave: (iso: string | null) => void
}

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

function DateInput({ value, onSave }: DateInputProps) {
  const [text, setText] = useState(isoToDisplay(value))
  const [focused, setFocused] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value
      if (!focused) setText(isoToDisplay(value))
    }
  }, [value, focused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(maskDate(e.target.value))
  }

  const handleBlur = () => {
    setFocused(false)
    if (!text.trim()) { onSave(null); return }
    const iso = displayToIso(text)
    if (iso) { onSave(iso) }
    else { setText(isoToDisplay(value)) }
  }

  return (
    <input
      type="text"
      value={focused ? text : isoToDisplay(value)}
      placeholder={focused ? 'DD.MM.RRRR' : ''}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      style={{
        width: '100%', textAlign: 'center', fontSize: 14,
        border: 'none', outline: 'none', background: 'transparent',
        cursor: 'text',
      }}
    />
  )
}

const filterInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #93c5fd', borderRadius: 3,
  padding: '3px 7px', fontSize: 12, outline: 'none',
  background: '#f0f9ff', color: '#1e40af',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<Status, React.CSSProperties> = {
  'Do zamówienia': { background: '#ea580c', color: '#fff' },
  'Zamówione':     { background: '#2563eb', color: '#fff' },
  'Dotarło':       { background: '#16a34a', color: '#fff' },
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span style={{
      ...STATUS_STYLE[status],
      borderRadius: 20, padding: '4px 14px',
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ marginLeft: 3, fontSize: 11, opacity: active ? 1 : 0.4 }}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )
}

// ─── Columns config ───────────────────────────────────────────────────────────

const COLS: { label: string; key: SortKey | null; width: number; align: 'center' | 'left'; filterable?: boolean }[] = [
  { label: 'Lp.',             key: null,              width: 44,  align: 'center' },
  { label: 'Numer Zlecenia',  key: 'numer_zlecenia',  width: 150, align: 'left',   filterable: true },
  { label: 'Nr Detalu',       key: 'nr_detalu',       width: 180, align: 'left',   filterable: true },
  { label: 'Ilość',           key: 'ilosc',           width: 70,  align: 'center' },
  { label: 'Data Zamówienia', key: 'data_zamowienia', width: 140, align: 'left'   },
  { label: 'Data Dostawy',    key: 'data_dostawy',    width: 140, align: 'left'   },
  { label: 'Status',          key: 'status',          width: 140, align: 'center' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HandlowkaPage() {
  const navigate = useNavigate()
  const [rows,    setRows]    = useState<HandlowkaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Filtry
  const [showFilters,    setShowFilters]    = useState(false)
  const [fNumerZlecenia, setFNumerZlecenia] = useState('')
  const [fNrDetalu,      setFNrDetalu]      = useState('')
  const [fStatus,        setFStatus]        = useState<Status | 'Wszystkie'>('Wszystkie')

  useEffect(() => {
    commercialApi.getParts()
      .then(parts => setRows(parts.map(toRow)))
      .finally(() => setLoading(false))
  }, [])

  const toggleSort = (key: SortKey | null) => {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const cycleStatus = (commercialId: number, currentStatus: Status) => {
    const order: Status[] = ['Do zamówienia', 'Zamówione', 'Dotarło']
    const idx = order.indexOf(currentStatus)
    if (idx === order.length - 1) return
    const next = order[idx + 1]
    const today = new Date().toISOString()
    setRows(prev => prev.map(r => {
      if (r.commercial_id !== commercialId) return r
      return {
        ...r,
        status:          next,
        data_zamowienia: next === 'Zamówione' ? today : r.data_zamowienia,
        data_dostawy:    next === 'Dotarło'   ? today : r.data_dostawy,
      }
    }))
    commercialApi.updateStatus(commercialId, next).catch(console.error)
  }

  const filtered = useMemo(() =>
    rows.filter(r =>
      r.numer_zlecenia.toLowerCase().includes(fNumerZlecenia.toLowerCase()) &&
      r.nr_detalu.toLowerCase().includes(fNrDetalu.toLowerCase()) &&
      (fStatus === 'Wszystkie' || r.status === fStatus)
    ), [rows, fNumerZlecenia, fNrDetalu, fStatus])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const hideFiltersOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setShowFilters(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14 }}>
      Ładowanie...
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>

      {/* ── Nagłówek ── */}
      <div style={{ flexShrink: 0, padding: '32px 28px 16px', background: '#fff', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700, color: '#1f2937' }}>
          Zamówienia Handlówki
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {(['Wszystkie', 'Do zamówienia', 'Zamówione', 'Dotarło'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFStatus(s)}
              style={{
                padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: '2px solid transparent',
                ...(fStatus === s
                  ? s === 'Wszystkie'
                    ? { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }
                    : STATUS_STYLE[s as Status]
                  : { background: '#f3f4f6', color: '#6b7280', borderColor: '#e5e7eb' }
                ),
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Treść ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 24px' }}>
        <div style={{ maxWidth: '70%', margin: '0 auto' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              {COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}
            </colgroup>

            <thead>
              <tr className="bg-blue-100 text-blue-700">
                {COLS.map((col, i) => {
                  const hasActiveFilter =
                    (i === 1 && !!fNumerZlecenia) ||
                    (i === 2 && !!fNrDetalu)
                  return (
                    <th
                      key={i}
                      onClick={() => toggleSort(col.key)}
                      className="border border-gray-300"
                      style={{
                        padding: '8px 12px',
                        textAlign: col.align,
                        fontWeight: 700,
                        cursor: col.key ? 'pointer' : 'default',
                        userSelect: 'none', whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center' }}>
                          {col.label}
                          {col.key && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                        </span>
                        {col.filterable && (
                          <span
                            title="Filtruj"
                            onClick={e => { e.stopPropagation(); setShowFilters(v => !v) }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              padding: '1px 3px', borderRadius: 3, flexShrink: 0,
                              background: hasActiveFilter ? '#2563eb' : 'transparent',
                              color: hasActiveFilter ? '#fff' : '#93c5fd',
                              fontSize: 10, lineHeight: 1, cursor: 'pointer',
                            }}
                          >▽</span>
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>

              {showFilters && (
                <tr className="bg-white">
                  <td className="border border-gray-300 px-1 py-1" />
                  <td className="border border-gray-300 px-1 py-1">
                    <input style={filterInput} placeholder="Szukaj..." value={fNumerZlecenia} onChange={e => setFNumerZlecenia(e.target.value)} onKeyDown={hideFiltersOnEnter} />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <input style={filterInput} placeholder="Szukaj..." value={fNrDetalu} onChange={e => setFNrDetalu(e.target.value)} onKeyDown={hideFiltersOnEnter} />
                  </td>
                  <td className="border border-gray-300 px-1 py-1" />
                  <td className="border border-gray-300 px-1 py-1" />
                  <td className="border border-gray-300 px-1 py-1" />
                  <td className="border border-gray-300 px-1 py-1" />
                </tr>
              )}
            </thead>

            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={row.commercial_id}
                  className="hover:bg-blue-50"
                  onMouseEnter={() => setHovered(row.commercial_id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700">{idx + 1}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-900">{row.numer_zlecenia}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-blue-600"
                    onClick={() => window.open(`/api/parts/${row.part_id}/pdf`, '_blank')}
                    style={{ cursor: 'pointer' }}
                  >{row.nr_detalu}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium">{row.ilosc}</td>
                  <td className="border border-gray-300 px-1 py-1 text-center">
                    <DateInput
                      value={row.data_zamowienia}
                      onSave={iso => {
                        setRows(prev => prev.map(r => r.commercial_id === row.commercial_id ? { ...r, data_zamowienia: iso } : r))
                        commercialApi.updateDates(row.commercial_id, iso, row.data_dostawy ? toDateInput(row.data_dostawy) : null).catch(console.error)
                      }}
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center">
                    <DateInput
                      value={row.data_dostawy}
                      onSave={iso => {
                        setRows(prev => prev.map(r => r.commercial_id === row.commercial_id ? { ...r, data_dostawy: iso } : r))
                        commercialApi.updateDates(row.commercial_id, row.data_zamowienia ? toDateInput(row.data_zamowienia) : null, iso).catch(console.error)
                      }}
                    />
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <button onClick={() => cycleStatus(row.commercial_id, row.status)} style={{ background: 'none', border: 'none', padding: 0, cursor: row.status === 'Dotarło' ? 'default' : 'pointer' }}>
                      <StatusBadge status={row.status} />
                    </button>
                  </td>
                </tr>
              ))}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-gray-300 text-center py-6 text-gray-400">
                    Brak wpisów
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
