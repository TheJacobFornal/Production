import { useState, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'Do zamówienia' | 'Zamówione' | 'Dotarło'
type SortKey = keyof Omit<HandlowkaRow, 'id'>
type SortDir = 'asc' | 'desc'

interface HandlowkaRow {
  id:               number
  numer_zlecenia:   string
  nr_detalu:        string
  ilosc:            number
  data_zamowienia:  string | null
  data_dostawy:     string | null
  status:           Status
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK: HandlowkaRow[] = [
  { id: 1, numer_zlecenia: 'W253013-BN-05', nr_detalu: 'BN06.40.00.00.08B', ilosc: 10, data_zamowienia: '2026-06-10', data_dostawy: null,         status: 'Do zamówienia' },
  { id: 2, numer_zlecenia: 'W253013-BN-05', nr_detalu: 'BN06.40.00.00.08B', ilosc: 3,  data_zamowienia: '2026-06-10', data_dostawy: '2026-06-10',  status: 'Zamówione'     },
  { id: 3, numer_zlecenia: 'W253013-BN-05', nr_detalu: 'BN06.40.00.00.08B', ilosc: 15, data_zamowienia: null,         data_dostawy: null,           status: 'Dotarło'       },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const [rows,    setRows]    = useState<HandlowkaRow[]>(MOCK)
  const [hovered, setHovered] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Filtry
  const [showFilters,    setShowFilters]    = useState(false)
  const [fNumerZlecenia, setFNumerZlecenia] = useState('')
  const [fNrDetalu,      setFNrDetalu]      = useState('')

  const toggleSort = (key: SortKey | null) => {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const cycleStatus = (id: number) => {
    const order: Status[] = ['Do zamówienia', 'Zamówione', 'Dotarło']
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const idx = order.indexOf(r.status)
      if (idx === order.length - 1) return r
      return { ...r, status: order[idx + 1] }
    }))
  }

  const filtered = useMemo(() =>
    rows.filter(r =>
      r.numer_zlecenia.toLowerCase().includes(fNumerZlecenia.toLowerCase()) &&
      r.nr_detalu.toLowerCase().includes(fNrDetalu.toLowerCase())
    ), [rows, fNumerZlecenia, fNrDetalu])

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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>

      {/* ── Nagłówek ── */}
      <div style={{ flexShrink: 0, padding: '32px 28px 24px', background: '#fff', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1f2937' }}>
          Zamówienia Handlówki
        </h1>
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
                  key={row.id}
                  className="hover:bg-blue-50"
                  onMouseEnter={() => setHovered(row.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-700">{idx + 1}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-blue-600">{row.numer_zlecenia}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-blue-600">{row.nr_detalu}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium">{row.ilosc}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatDate(row.data_zamowienia)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatDate(row.data_dostawy)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <button onClick={() => cycleStatus(row.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: row.status === 'Dotarło' ? 'default' : 'pointer' }}>
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
