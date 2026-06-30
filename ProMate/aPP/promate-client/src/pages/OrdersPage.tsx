import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersApi, importApi } from '../services/api'
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

// ─── Etykiety faz zamówienia ──────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  Z2:   'Nowe',
  Z3:   'Zaplanowane',
  Z4:   'Gotowe do produkcji',
  Z5:   'W produkcji',
  Z6:   'Wyprodukowane',
  Z7:   'Wycenione',
  Z100: 'Anulowane',
}

const PHASE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Z2:   { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
  Z3:   { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  Z4:   { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  Z5:   { bg: '#ffedd5', text: '#c2410c', dot: '#f97316' },
  Z6:   { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Z7:   { bg: '#f3e8ff', text: '#7e22ce', dot: '#a855f7' },
  Z100: { bg: '#FF5656', text: '#fff', dot: '#fff' },
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

  const [showAddModal, setShowAddModal] = useState(false)
  const [newOrderNum,  setNewOrderNum]  = useState('')
  const [newRodzaj,    setNewRodzaj]    = useState<'wew' | 'zew'>('wew')

  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; error?: string } | null>(null)

  const handleImport = () => {
    setImporting(true)
    setImportResult(null)
    importApi.run()
      .then(res => {
        console.log('[Import] odpowiedź backendu:', res)
        console.log('[Import] output exe:\n', res.output)
        setImportResult({ added: res.added, error: res.error })
        if (!res.error) fetchOrders()
      })
      .catch(() => setImportResult({ added: -1, error: 'Błąd połączenia z serwerem' }))
      .finally(() => setImporting(false))
  }

  const handleCreate = () => {
    if (!newOrderNum.trim()) return
    setShowAddModal(false)
    navigate(`/orders/nowe/${encodeURIComponent(newOrderNum.trim())}`, { state: { rodzaj: newRodzaj } })
  }

  // Filtry per kolumna
  const [showFilters,  setShowFilters]  = useState(false)
  const [fNumer,       setFNumer]       = useState('')
  const [fTermin,      setFTermin]      = useState('')
  const [fLiczba,      setFLiczba]      = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [showStatusDrop, setShowStatusDrop] = useState(false)
  const [statusDropPos,  setStatusDropPos]  = useState({ top: 0, left: 0, width: 0 })

  const statusDropRef    = useRef<HTMLDivElement>(null)
  const statusDropBtnRef = useRef<HTMLTableCellElement>(null)

  const hasActiveFilter = fNumer || fTermin || fLiczba || statusFilter.size > 0

  // Sortowanie
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const fetchOrders = () => {
    setError(null)
    ordersApi.getSummaryList()
      .then(data => { setOrders(data); setLoading(false) })
      .catch(() => { setError('Nie można pobrać zamówień'); setLoading(false) })
  }

  useEffect(() => { fetchOrders() }, [])

  // Zamknij dropdown po kliknięciu poza
  useEffect(() => {
    if (!showStatusDrop) return
    const handler = (e: MouseEvent) => {
      if (
        statusDropRef.current && !statusDropRef.current.contains(e.target as Node) &&
        statusDropBtnRef.current && !statusDropBtnRef.current.contains(e.target as Node)
      ) setShowStatusDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showStatusDrop])

  const allStatuses = useMemo(() =>
    Array.from(new Set(
      orders.map(o => o.phase_name ? (PHASE_LABELS[o.phase_name] ?? o.phase_name) : null)
            .filter(Boolean) as string[]
    )).sort()
  , [orders])

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const toggleStatus = (s: string) => {
    setStatusFilter(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const display = useMemo(() => {
    let list = orders.filter(o =>
      o.order_number.toLowerCase().includes(fNumer.toLowerCase()) &&
      formatDate(o.deadline_at).includes(fTermin) &&
      String(o.parts_count).includes(fLiczba) &&
      (statusFilter.size === 0 || statusFilter.has(PHASE_LABELS[o.phase_name ?? ''] ?? o.phase_name ?? ''))
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
  }, [orders, fNumer, fTermin, fLiczba, statusFilter, sortCol, sortDir])

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

      {/* Przyciski */}
      <div className="max-w-4xl mx-auto mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6,
              padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: importing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, opacity: importing ? 0.6 : 1,
            }}
          >
            {importing ? '⏳ Odświeżam...' : '↻ Odśwież zamówienia'}
          </button>
          {importResult && (
            <span
              title={importResult.error ?? undefined}
              style={{
                fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
                cursor: importResult.error ? 'help' : 'default',
                background: importResult.error ? '#fee2e2' : importResult.added === 0 ? '#f1f5f9' : '#dcfce7',
                color:      importResult.error ? '#dc2626' : importResult.added === 0 ? '#64748b' : '#15803d',
              }}
            >
              {importResult.error
                ? `✕ ${importResult.error}`
                : importResult.added === 0
                  ? 'Brak nowych zamówień'
                  : `✓ Dodano ${importResult.added} zamówień`}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowAddModal(true); setNewOrderNum('') }}
          style={{
            background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6,
            padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          + Dodaj zamówienie
        </button>
      </div>

      {/* Modal: nowe zamówienie */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 10, padding: '28px 32px', width: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: '#1f2937' }}>
              Nowe zamówienie
            </h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Numer zlecenia
            </label>
            <input
              autoFocus
              value={newOrderNum}
              onChange={e => setNewOrderNum(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowAddModal(false) }}
              placeholder="np. 252603-IX92-06"
              style={{
                width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 6,
                padding: '8px 12px', fontSize: 14, outline: 'none', marginBottom: 16,
              }}
            />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
              Rodzaj zamówienia
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['wew', 'zew'] as const).map(val => (
                <button
                  key={val}
                  onClick={() => setNewRodzaj(val)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 14, cursor: 'pointer',
                    border: newRodzaj === val ? 'none' : '1px solid #d1d5db',
                    background: newRodzaj === val ? '#1d4ed8' : '#f9fafb',
                    color: newRodzaj === val ? '#fff' : '#374151',
                    fontWeight: newRodzaj === val ? 700 : 400,
                  }}
                >
                  {val === 'wew' ? 'Wewnętrzne' : 'Zewnętrzne'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 13, cursor: 'pointer' }}
              >
                Anuluj
              </button>
              <button
                onClick={handleCreate}
                disabled={!newOrderNum.trim()}
                style={{
                  padding: '7px 18px', borderRadius: 6, border: 'none',
                  background: newOrderNum.trim() ? '#1d4ed8' : '#93c5fd',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: newOrderNum.trim() ? 'pointer' : 'default',
                }}
              >
                Dalej →
              </button>
            </div>
          </div>
        </div>
      )}

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

                {/* ── Kolumna Status z dropdownem ── */}
                <th
                  ref={statusDropBtnRef}
                  className="border border-gray-300"
                  style={{ ...thStyle, cursor: 'pointer' }}
                  onClick={e => {
                    e.stopPropagation()
                    const rect = statusDropBtnRef.current!.getBoundingClientRect()
                    setStatusDropPos({ top: rect.bottom + 2, left: rect.left + rect.width / 2, width: rect.width })
                    setShowStatusDrop(v => !v)
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <span>Status</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '1px 4px', borderRadius: 3,
                      background: statusFilter.size > 0 ? '#2563eb' : 'transparent',
                      color: statusFilter.size > 0 ? '#fff' : '#93c5fd',
                      fontSize: 10, lineHeight: 1,
                    }}>▽</span>
                  </span>
                </th>
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
                <td className="border border-gray-300 px-1 py-1" />
              </tr>}
            </thead>

            <tbody>
              {display.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-400">Brak zamówień</td>
                </tr>
              ) : (
                display.map((order, i) => {
                  const hasMissing   = order.missing_drawings_count > 0
                  const isCancelled  = order.phase_name === 'Z100'
                  const isInProd     = order.phase_name === 'Z5' || order.phase_name === 'Z4'
                  const isDone       = order.phase_name === 'Z6'
                  const defaultBg    = isCancelled ? '#fee2e2' : isInProd ? '#FFE8D0' : isDone ? '#C8FDB7' : hasMissing ? '#f3f4f6' : undefined
                  const hoverBg      = isCancelled ? '#fecaca' : isInProd ? '#ffd8b8' : isDone ? '#b2f59e' : hasMissing ? '#e5e7eb' : '#eff6ff'
                  return (
                  <tr key={order.order_number}
                    style={{ background: defaultBg }}
                    className="cursor-pointer"
                    onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={e => (e.currentTarget.style.background = defaultBg ?? '')}
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
                      {order.phase_name === 'Z5'
                        ? <ProgressBar completed={order.d10_count} total={order.parts_count} />
                        : <ProgressBar completed={order.completed_count} total={order.parts_count} />
                      }
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {order.phase_name && (() => {
                        const label  = PHASE_LABELS[order.phase_name] ?? order.phase_name
                        const colors = PHASE_COLORS[order.phase_name]
                        return colors ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 20,
                            background: colors.bg, color: colors.text,
                            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
                            {label}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
                        )
                      })()}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Dropdown statusów (fixed, poza scroll) ── */}
      {showStatusDrop && (
        <div
          ref={statusDropRef}
          style={{
            position: 'fixed', top: statusDropPos.top, left: statusDropPos.left,
            transform: 'translateX(-50%)',
            width: Math.max(statusDropPos.width, 160),
            background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 1000,
            padding: '6px 0',
          }}
        >
          {statusFilter.size > 0 && (
            <div
              onClick={() => setStatusFilter(new Set())}
              style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
            >
              Wyczyść filtr
            </div>
          )}
          {allStatuses.length === 0 && (
            <div style={{ padding: '6px 12px', fontSize: 12, color: '#9ca3af' }}>Brak statusów</div>
          )}
          {(() => {
            const labelToKey = Object.fromEntries(Object.entries(PHASE_LABELS).map(([k, v]) => [v, k]))
            return allStatuses.map(s => {
              const phaseKey = labelToKey[s]
              const colors   = phaseKey ? PHASE_COLORS[phaseKey] : undefined
              return (
                <label
                  key={s}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 12px', cursor: 'pointer', fontSize: 13,
                    background: statusFilter.has(s) ? '#f1f5f9' : 'transparent',
                  }}
                  onClick={e => { e.stopPropagation(); toggleStatus(s) }}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={statusFilter.has(s)}
                    style={{ accentColor: '#2563eb', width: 14, height: 14, flexShrink: 0 }}
                  />
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px', borderRadius: 20,
                    background: colors?.bg ?? '#dbeafe',
                    color:      colors?.text ?? '#1e40af',
                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors?.dot ?? '#3b82f6', flexShrink: 0 }} />
                    {s}
                  </span>
                </label>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
