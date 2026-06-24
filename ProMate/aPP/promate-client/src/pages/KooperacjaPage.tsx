import { useState, useMemo, useEffect, useRef } from 'react'
import { cooperationLogApi, KoopPanelRow } from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type KoopStatus = 'Gotowe do koop.' | 'W trakcie' | 'Skończone'
type SortKey = 'order_number' | 'part_number' | 'quantity' | 'cooperation_name' | 'sent_at' | 'received_at' | 'phase_name'
type SortDir = 'asc' | 'desc'

// ─── Status helpers ───────────────────────────────────────────────────────────

const PHASE_TO_STATUS: Record<string, KoopStatus> = {
  'Oczekuje':     'Gotowe do koop.',
  'W realizacji': 'W trakcie',
  'Wykonana':     'Skończone',
}

const STATUS_STYLE: Record<KoopStatus, React.CSSProperties> = {
  'Gotowe do koop.': { background: '#dc2626', color: '#fff' },
  'W trakcie':       { background: '#ea580c', color: '#fff' },
  'Skończone':       { background: '#16a34a', color: '#fff' },
}

function getStatus(phaseName: string | null): KoopStatus {
  return (phaseName && PHASE_TO_STATUS[phaseName]) || 'Gotowe do koop.'
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

interface DateInputProps {
  value:    string | null
  onSave:   (iso: string | null) => void
  disabled?: boolean
}

function DateInput({ value, onSave, disabled }: DateInputProps) {
  const [text,    setText]    = useState(isoToDisplay(value))
  const [focused, setFocused] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value
      if (!focused) setText(isoToDisplay(value))
    }
  }, [value, focused])

  if (disabled) return null

  return (
    <input
      type="text"
      value={focused ? text : isoToDisplay(value)}
      placeholder={focused ? 'DD.MM.RRRR' : ''}
      onChange={e => setText(maskDate(e.target.value))}
      onFocus={() => { setFocused(true); setText(isoToDisplay(value)) }}
      onBlur={() => {
        setFocused(false)
        if (!text.trim()) { onSave(null); return }
        const iso = displayToIso(text)
        if (iso) onSave(iso)
        else setText(isoToDisplay(value))
      }}
      style={{
        width: '100%', textAlign: 'center', fontSize: 14,
        border: 'none', outline: 'none', background: 'transparent', cursor: 'text',
      }}
    />
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const filterInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #93c5fd', borderRadius: 3,
  padding: '3px 7px', fontSize: 12, outline: 'none',
  background: '#f0f9ff', color: '#1e40af',
}

function StatusBadge({ status }: { status: KoopStatus }) {
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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ marginLeft: 3, fontSize: 11, opacity: active ? 1 : 0.4 }}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )
}

// ─── Column config ────────────────────────────────────────────────────────────

const COLS: { label: string; key: SortKey | null; width: number; align: 'center' | 'left'; filterable?: boolean }[] = [
  { label: 'Lp.',            key: null,               width: 44,  align: 'center' },
  { label: 'Numer Zlecenia', key: 'order_number',     width: 150, align: 'left', filterable: true },
  { label: 'Nr Detalu',      key: 'part_number',      width: 180, align: 'left', filterable: true },
  { label: 'Ilość',          key: 'quantity',         width: 70,  align: 'center' },
  { label: 'Kooperacja',     key: 'cooperation_name', width: 150, align: 'left', filterable: true },
  { label: 'Data Wyjazdu',   key: 'sent_at',          width: 140, align: 'center' },
  { label: 'Data Przyjazdu', key: 'received_at',      width: 140, align: 'center' },
  { label: 'Status',         key: 'phase_name',       width: 160, align: 'center' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KooperacjaPage() {
  const [rows,    setRows]    = useState<KoopPanelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir,     setSortDir]     = useState<SortDir>('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [fZlecenia,   setFZlecenia]   = useState('')
  const [fDetalu,     setFDetalu]     = useState('')
  const [fKoop,       setFKoop]       = useState('')
  const [fStatus,     setFStatus]     = useState<KoopStatus | 'Wszystkie'>('Wszystkie')

  useEffect(() => {
    cooperationLogApi.getPanel()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  const toggleSort = (key: SortKey | null) => {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const cycleStatus = (row: KoopPanelRow) => {
    if (row.phase_name === 'Wykonana') return
    cooperationLogApi.cyclePhase(row.part_id, row.slot)
      .then(updated => {
        if (!updated.phase_id) return
        setRows(prev => prev.map(r =>
          r.part_id === row.part_id && r.slot === row.slot
            ? { ...r, phase_id: updated.phase_id, phase_name: updated.phase_name, sent_at: updated.sent_at, received_at: updated.received_at }
            : r
        ))
      })
      .catch(console.error)
  }

  const filtered = useMemo(() =>
    rows.filter(r =>
      r.order_number.toLowerCase().includes(fZlecenia.toLowerCase()) &&
      r.part_number.toLowerCase().includes(fDetalu.toLowerCase()) &&
      r.cooperation_name.toLowerCase().includes(fKoop.toLowerCase()) &&
      (fStatus === 'Wszystkie' || getStatus(r.phase_name) === fStatus)
    ), [rows, fZlecenia, fDetalu, fKoop, fStatus])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

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
          Panel Kooperacji
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {(['Wszystkie', 'Gotowe do koop.', 'W trakcie', 'Skończone'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFStatus(s)}
              style={{
                padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: '2px solid transparent',
                ...(fStatus === s
                  ? s === 'Wszystkie'
                    ? { background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }
                    : STATUS_STYLE[s as KoopStatus]
                  : { background: '#f3f4f6', color: '#6b7280', borderColor: '#e5e7eb' }
                ),
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabela ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 24px' }}>
        <div style={{ maxWidth: '90%', margin: '0 auto' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              {COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}
            </colgroup>

            <thead>
              <tr className="bg-blue-100 text-blue-700">
                {COLS.map((col, i) => {
                  const hasActiveFilter =
                    (i === 1 && !!fZlecenia) ||
                    (i === 2 && !!fDetalu)   ||
                    (i === 4 && !!fKoop)
                  return (
                    <th
                      key={i}
                      onClick={() => toggleSort(col.key)}
                      className="border border-gray-300"
                      style={{
                        padding: '8px 12px', textAlign: col.align, fontWeight: 700,
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
                    <input style={filterInput} placeholder="Szukaj..." value={fZlecenia} onChange={e => setFZlecenia(e.target.value)} />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <input style={filterInput} placeholder="Szukaj..." value={fDetalu} onChange={e => setFDetalu(e.target.value)} />
                  </td>
                  <td className="border border-gray-300 px-1 py-1" />
                  <td className="border border-gray-300 px-1 py-1">
                    <input style={filterInput} placeholder="Szukaj..." value={fKoop} onChange={e => setFKoop(e.target.value)} />
                  </td>
                  <td className="border border-gray-300 px-1 py-1" />
                  <td className="border border-gray-300 px-1 py-1" />
                  <td className="border border-gray-300 px-1 py-1" />
                </tr>
              )}
            </thead>

            <tbody>
              {sorted.map((row, idx) => {
                const status = getStatus(row.phase_name)
                return (
                  <tr key={`${row.part_id}-${row.slot}`} className="hover:bg-blue-50">
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700">{idx + 1}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-900">{row.order_number}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium text-blue-600">{row.part_number}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium">{row.quantity}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-800">{row.cooperation_name}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center">
                      <DateInput
                        value={row.sent_at}
                        disabled={status === 'Gotowe do koop.'}
                        onSave={iso => {
                          setRows(prev => prev.map(r =>
                            r.part_id === row.part_id && r.slot === row.slot ? { ...r, sent_at: iso } : r
                          ))
                          cooperationLogApi.updateDates(row.part_id, row.slot, iso, row.received_at).catch(console.error)
                        }}
                      />
                    </td>
                    <td className="border border-gray-300 px-1 py-1 text-center">
                      <DateInput
                        value={row.received_at}
                        disabled={status === 'Gotowe do koop.' || status === 'W trakcie'}
                        onSave={iso => {
                          setRows(prev => prev.map(r =>
                            r.part_id === row.part_id && r.slot === row.slot ? { ...r, received_at: iso } : r
                          ))
                          cooperationLogApi.updateDates(row.part_id, row.slot, row.sent_at, iso).catch(console.error)
                        }}
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <button
                        onClick={() => cycleStatus(row)}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          cursor: status === 'Skończone' ? 'default' : 'pointer',
                        }}
                      >
                        <StatusBadge status={status} />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-gray-300 text-center py-6 text-gray-400">
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
