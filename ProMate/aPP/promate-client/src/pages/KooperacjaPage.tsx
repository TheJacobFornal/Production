import { useState, useMemo, useEffect, useRef } from 'react'
import { cooperationLogApi, KoopPanelRow } from '../services/api'
import { PartDetailContent } from './PartDetailPage'

// ─── Types ────────────────────────────────────────────────────────────────────

type KoopStatus = 'Gotowe do koop.' | 'W trakcie' | 'Skończone'
type SortKey = 'order_number' | 'part_number' | 'part_name' | 'quantity' | 'cooperation_name' | 'sent_at' | 'received_at' | 'phase_name'
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

const BORDER = '1px solid #d1d5db'
const BLUE   = '#1e40af'

const filterInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: BORDER, borderRadius: 0,
  padding: '4px 8px', fontSize: 13, outline: 'none',
  background: '#fff', color: '#0f172a',
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
  { label: 'Nr Detalu',      key: 'part_number',      width: 160, align: 'left', filterable: true },
  { label: 'Nazwa Detalu',   key: 'part_name',        width: 160, align: 'left', filterable: true },
  { label: 'Ilość',          key: 'quantity',         width: 70,  align: 'center' },
  { label: 'Kooperacja',     key: 'cooperation_name', width: 150, align: 'left', filterable: true },
  { label: 'Data Wyjazdu',   key: 'sent_at',          width: 140, align: 'center' },
  { label: 'Data Przyjazdu', key: 'received_at',      width: 140, align: 'center' },
  { label: 'Status',         key: 'phase_name',       width: 160, align: 'center' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KooperacjaPage() {
  const [detailPartId, setDetailPartId] = useState<number | null>(null)
  const [rows,    setRows]    = useState<KoopPanelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir,     setSortDir]     = useState<SortDir>('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [fZlecenia,   setFZlecenia]   = useState('')
  const [fDetalu,     setFDetalu]     = useState('')
  const [fNazwa,      setFNazwa]      = useState('')
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
      r.part_name.toLowerCase().includes(fNazwa.toLowerCase()) &&
      r.cooperation_name.toLowerCase().includes(fKoop.toLowerCase()) &&
      (fStatus === 'Wszystkie' || getStatus(r.phase_name) === fStatus)
    ), [rows, fZlecenia, fDetalu, fNazwa, fKoop, fStatus])

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

  const TH: React.CSSProperties = {
    background: '#e8edf2', color: '#374151', fontWeight: 700, fontSize: 11,
    padding: '10px 14px', border: BORDER, textAlign: 'center',
    whiteSpace: 'nowrap', userSelect: 'none', letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  }
  const TD: React.CSSProperties = {
    border: BORDER, padding: '9px 14px', fontSize: 13,
    color: '#1e293b', textAlign: 'center',
  }

  return (
    <>
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
        <div style={{ maxWidth: 1260, margin: '0 auto', background: '#fff', border: BORDER, borderTop: `3px solid ${BLUE}` }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              {COLS.map((c, i) => <col key={i} style={{ width: c.width }} />)}
            </colgroup>

            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                {COLS.map((col, i) => {
                  const hasActiveFilter =
                    (i === 1 && !!fZlecenia) ||
                    (i === 2 && !!fDetalu)   ||
                    (i === 3 && !!fNazwa)    ||
                    (i === 5 && !!fKoop)
                  return (
                    <th key={i} onClick={() => toggleSort(col.key)} style={{ ...TH, cursor: col.key ? 'pointer' : 'default' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {col.label}
                        {col.key && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                        {col.filterable && (
                          <span
                            onClick={e => { e.stopPropagation(); setShowFilters(v => !v) }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              padding: '1px 4px', flexShrink: 0,
                              background: hasActiveFilter ? BLUE : 'transparent',
                              color: hasActiveFilter ? '#fff' : '#93c5fd',
                              fontSize: 10, cursor: 'pointer',
                            }}
                          >▽</span>
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>

              {showFilters && (
                <tr style={{ background: '#f8fafc' }}>
                  <td style={{ ...TD, padding: 4 }} />
                  <td style={{ ...TD, padding: 4 }}><input style={filterInput} placeholder="Szukaj..." value={fZlecenia} onChange={e => setFZlecenia(e.target.value)} /></td>
                  <td style={{ ...TD, padding: 4 }}><input style={filterInput} placeholder="Szukaj..." value={fDetalu}   onChange={e => setFDetalu(e.target.value)}   /></td>
                  <td style={{ ...TD, padding: 4 }}><input style={filterInput} placeholder="Szukaj..." value={fNazwa}    onChange={e => setFNazwa(e.target.value)}    /></td>
                  <td style={{ ...TD, padding: 4 }} />
                  <td style={{ ...TD, padding: 4 }}><input style={filterInput} placeholder="Szukaj..." value={fKoop}     onChange={e => setFKoop(e.target.value)}     /></td>
                  <td style={{ ...TD, padding: 4 }} />
                  <td style={{ ...TD, padding: 4 }} />
                  <td style={{ ...TD, padding: 4 }} />
                </tr>
              )}
            </thead>

            <tbody>
              {sorted.map((row, idx) => {
                const status = getStatus(row.phase_name)
                const rowBg  = idx % 2 === 0 ? '#fff' : '#fafafa'
                return (
                  <tr key={`${row.part_id}-${row.slot}`}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                    style={{ background: rowBg }}
                  >
                    <td style={{ ...TD, color: '#9ca3af', fontWeight: 500, fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ ...TD, fontWeight: 500 }}>{row.order_number}</td>
                    <td
                      style={{ ...TD, color: BLUE, fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setDetailPartId(row.part_id)}
                    >{row.part_number}</td>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 500 }}>{row.part_name}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{row.quantity_left > 0 ? `${row.quantity_right} + ${row.quantity_left}L` : String(row.quantity_right)}</td>
                    <td style={{ ...TD, fontWeight: 500 }}>{row.cooperation_name}</td>
                    <td style={{ ...TD, padding: '2px 6px' }}>
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
                    <td style={{ ...TD, padding: '2px 6px' }}>
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
                    <td style={{ ...TD }}>
                      <button
                        onClick={() => cycleStatus(row)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: status === 'Skończone' ? 'default' : 'pointer' }}
                      >
                        <StatusBadge status={status} />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...TD, color: '#9ca3af', padding: '24px', fontStyle: 'italic' }}>
                    Brak wpisów
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {detailPartId && (
      <div style={{ position: 'fixed', top: 0, left: 56, right: 0, bottom: 0, zIndex: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PartDetailContent
          part_id={detailPartId}
          onClose={() => setDetailPartId(null)}
        />
      </div>
    )}
    </>
  )
}
