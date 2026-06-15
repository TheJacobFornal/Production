import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersApi } from '../services/api'
import { OrderListItem } from '../types'

// ─── Pasek postępu ────────────────────────────────────────────────────────────

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct   = total > 0 ? Math.round((completed / total) * 100) : 0
  const color = pct === 100 ? '#22c55e' : pct >= 50 ? '#facc15' : pct > 0 ? '#fb923c' : '#e5e7eb'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 120, height: 18, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', border: '1px solid #d1d5db', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Formatowanie daty ────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Typy sortowania ──────────────────────────────────────────────────────────

type SortCol = 'order_number' | 'deadline_at' | 'parts_count' | 'pct'
type SortDir = 'asc' | 'desc'

// ─── Ikona sortowania ─────────────────────────────────────────────────────────

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  const active = sortCol === col
  return (
    <span style={{ marginLeft: 3, fontSize: 11, opacity: active ? 1 : 0.4 }}>
      {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )
}

// ─── Input filtra ─────────────────────────────────────────────────────────────

const filterInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #93c5fd', borderRadius: 3,
  padding: '3px 7px', fontSize: 12, outline: 'none',
  background: '#f0f9ff', color: '#1e40af',
}

// ─── Strona zamówień ──────────────────────────────────────────────────────────

export default function OrdersPage() {
  const navigate = useNavigate()
  const [orders,  setOrders]  = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Filtry per kolumna
  const [showFilters, setShowFilters] = useState(false)
  const [fNumer,   setFNumer]   = useState('')
  const [fTermin,  setFTermin]  = useState('')
  const [fLiczba,  setFLiczba]  = useState('')

  const hasActiveFilter = fNumer || fTermin || fLiczba

  // Sortowanie
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    ordersApi.getSummaryList()
      .then(data => setOrders(data))
      .catch(() => setError('Nie można pobrać zamówień'))
      .finally(() => setLoading(false))
  }, [])

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const display = useMemo(() => {
    let list = orders.filter(o =>
      o.order_number.toLowerCase().includes(fNumer.toLowerCase()) &&
      formatDate(o.deadline_at).includes(fTermin) &&
      String(o.parts_count).includes(fLiczba)
    )

    if (sortCol) {
      list = [...list].sort((a, b) => {
        let va: string | number = ''
        let vb: string | number = ''
        if (sortCol === 'order_number') { va = a.order_number; vb = b.order_number }
        if (sortCol === 'deadline_at')  { va = a.deadline_at ?? ''; vb = b.deadline_at ?? '' }
        if (sortCol === 'parts_count')  { va = a.parts_count; vb = b.parts_count }
        if (sortCol === 'pct') {
          va = a.parts_count > 0 ? a.completed_count / a.parts_count : 0
          vb = b.parts_count > 0 ? b.completed_count / b.parts_count : 0
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1
        if (va > vb) return sortDir === 'asc' ?  1 : -1
        return 0
      })
    }
    return list
  }, [orders, fNumer, fTermin, fLiczba, sortCol, sortDir])

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'center', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700,
  }

  return (
    <div className="h-full overflow-auto bg-white p-8">

      {/* Logo + Nagłówek w jednej linii */}
      <div className="max-w-4xl mx-auto mb-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1f2937' }}>Zamówienia</h1>
        <img src="/Logo.png" alt="ProMate" className="h-24 object-contain" />
      </div>

      {/* Tabela */}
      <div className="max-w-4xl mx-auto">
        {loading && <p className="text-gray-400 text-center py-8">Ładowanie...</p>}
        {error   && <p className="text-red-500 text-center py-8">{error}</p>}

        {!loading && !error && (
          <table className="w-full border-collapse" style={{ fontSize: 13 }}>
            <thead>
              {/* ── Wiersz nagłówków z sortowaniem ── */}
              <tr className="bg-blue-100 text-blue-700">
                <th className="border border-gray-300 text-center w-12" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700 }}>Lp.</th>
                {([
                  { label: 'Numer Zlecenia', col: 'order_number' as SortCol, hasFilter: !!fNumer  },
                  { label: 'Termin Wyk.',    col: 'deadline_at'  as SortCol, hasFilter: !!fTermin },
                  { label: 'Liczba części',  col: 'parts_count'  as SortCol, hasFilter: !!fLiczba },
                  { label: 'Zrealizowane',   col: 'pct'          as SortCol, hasFilter: false      },
                ]).map(({ label, col, hasFilter }) => (
                  <th key={col} className="border border-gray-300" style={thStyle} onClick={() => toggleSort(col)}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center' }}>
                        {label}
                        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                      </span>
                      {col !== 'pct' && (
                        <span
                          title="Filtruj"
                          onClick={e => { e.stopPropagation(); setShowFilters(v => !v) }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: '1px 3px', borderRadius: 3, flexShrink: 0,
                            background: hasFilter ? '#2563eb' : 'transparent',
                            color: hasFilter ? '#fff' : '#93c5fd',
                            fontSize: 10, lineHeight: 1, cursor: 'pointer',
                          }}
                        >▽</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>

              {/* ── Wiersz filtrów ── */}
              {showFilters && <tr className="bg-white">
                <td className="border border-gray-300 px-1 py-1" />
                <td className="border border-gray-300 px-1 py-1">
                  <input style={filterInput} placeholder="Szukaj..." value={fNumer}  onChange={e => setFNumer(e.target.value)}  onKeyDown={e => e.key === 'Enter' && setShowFilters(false)} />
                </td>
                <td className="border border-gray-300 px-1 py-1">
                  <input style={filterInput} placeholder="Szukaj..." value={fTermin} onChange={e => setFTermin(e.target.value)} onKeyDown={e => e.key === 'Enter' && setShowFilters(false)} />
                </td>
                <td className="border border-gray-300 px-1 py-1">
                  <input style={filterInput} placeholder="Szukaj..." value={fLiczba} onChange={e => setFLiczba(e.target.value)} onKeyDown={e => e.key === 'Enter' && setShowFilters(false)} />
                </td>
                <td className="border border-gray-300 px-1 py-1" />
              </tr>}
            </thead>

            <tbody>
              {display.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-400">Brak zamówień</td>
                </tr>
              ) : (
                display.map((order, i) => (
                  <tr key={order.order_number} className="hover:bg-blue-50 cursor-pointer"
                    onClick={() => navigate(`/orders/${encodeURIComponent(order.order_number)}`)}>
                    <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-medium text-blue-600 hover:underline">
                      {order.order_number}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {formatDate(order.deadline_at)}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {order.parts_count}
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <ProgressBar completed={order.completed_count} total={order.parts_count} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
