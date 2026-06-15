import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ordersApi } from '../services/api'
import { Part } from '../types'

// ─── types ─────────────────────────────────────────────────────────────────────

type CellColor = '' | 'g' | 'y' | 'r'

interface Row {
  id:             number
  numer_zlecenia: string
  termin_wyk:     string
  numer_detalu:   string
  nazwa_detalu:   string
  ilosc:          string
  ploter:         string; ploter_c:    CellColor
  fkg:            string; fkg_c:       CellColor
  fko:            string; fko_c:       CellColor
  tok:            string; tok_c:       CellColor
  tokcnc:         string; tokcnc_c:    CellColor
  fcnc:           string; fcnc_c:      CellColor
  fcnc_robo:      string; fcnc_robo_c: CellColor
  kop1:           string
  data_wys:       string
  pozostaly_czas: string
  data_zak:       string
}

interface ColDef {
  key:        string
  label:      string
  readOnly?:  boolean
  colorKey?:  string
  stickyIdx?: number
  width:      number
}

// ─── column definitions ──────────────────────────────────────────────────────

const COLS: ColDef[] = [
  { key: 'lp',             label: 'Lp.',           readOnly: true, stickyIdx: 0, width: 40  },
  { key: 'numer_zlecenia', label: 'Nr Zlecenia',    readOnly: true, stickyIdx: 1, width: 140 },
  { key: 'termin_wyk',     label: 'Termin Wyk.',    readOnly: true, stickyIdx: 2, width: 95  },
  { key: 'numer_detalu',   label: 'Nr Detalu',                      stickyIdx: 3, width: 160 },
  { key: 'nazwa_detalu',   label: 'Nazwa Detalu',                   stickyIdx: 4, width: 145 },
  { key: 'ilosc',          label: 'Ilość',                          stickyIdx: 5, width: 52  },
  { key: 'ploter',         label: 'Ploter',    colorKey: 'ploter_c',    width: 65 },
  { key: 'fkg',            label: 'FKG',       colorKey: 'fkg_c',       width: 65 },
  { key: 'fko',            label: 'FKO',       colorKey: 'fko_c',       width: 65 },
  { key: 'tok',            label: 'TOK',       colorKey: 'tok_c',       width: 65 },
  { key: 'tokcnc',         label: 'TOKCNC',    colorKey: 'tokcnc_c',    width: 72 },
  { key: 'fcnc',           label: 'FCNC',      colorKey: 'fcnc_c',      width: 65 },
  { key: 'fcnc_robo',      label: 'FCNC ROBO', colorKey: 'fcnc_robo_c', width: 80 },
  { key: 'kop1',           label: 'Kop. 1',                             width: 100 },
  { key: 'data_wys',       label: 'Data Wys.',                          width: 90  },
  { key: 'pozostaly_czas', label: 'Pozostały Czas',                     width: 110 },
  { key: 'data_zak',       label: 'Data Zak.',                          width: 90  },
]

// ─── layout constants ────────────────────────────────────────────────────────

const _WS     = COLS.filter(c => c.stickyIdx !== undefined).map(c => c.width)
const WS_LEFT = _WS.reduce<number[]>((acc, _, i) =>
  [...acc, i === 0 ? 0 : acc[i - 1] + _WS[i - 1]], [])
const STICKY_W = _WS.reduce((s, w) => s + w, 0)

const COL_LEFT = COLS.reduce<number[]>((acc, _, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + COLS[i - 1].width)
  return acc
}, [])

// ─── design tokens ───────────────────────────────────────────────────────────

const PAGE_BG        = '#f8fafc'
const TH_BG          = '#1e293b'
const TH_TEXT        = '#f8fafc'
const TFOOT_BG1      = '#f1f5f9'
const TFOOT_BG2      = '#e2e8f0'
const ROW_BG_EVEN    = '#ffffff'
const ROW_BG_ODD     = '#f8fafc'
const BG_CELL_ACTIVE = '#dbeafe'
const BG_ROW_ACTIVE  = '#eff6ff'
const ACTIVE_RING    = '#3b82f6'
const BORDER         = '1px solid #e2e8f0'
const BORDER_HARD    = '1px solid #cbd5e1'
const ROW_H          = 32
const TFOOT_H        = 28

type OpColor = 'g' | 'y' | 'r'
const OP_CLR: Record<OpColor, { bg: string; text: string }> = {
  g: { bg: '#22c55e', text: '#fff' },
  y: { bg: '#eab308', text: '#fff' },
  r: { bg: '#ef4444', text: '#fff' },
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function stickyBase(col: ColDef, bg: string): React.CSSProperties {
  if (col.stickyIdx === undefined) return {}
  return { position: 'sticky', left: WS_LEFT[col.stickyIdx], zIndex: 2, background: bg }
}

function getCellValue(col: ColDef, row: Row, lp: number): string {
  if (col.key === 'lp') return String(lp)
  return String((row as unknown as Record<string, unknown>)[col.key] ?? '')
}

function partToRow(p: Part, orderNumber: string, termin: string): Row {
  return {
    id: p.id, numer_zlecenia: orderNumber, termin_wyk: termin,
    numer_detalu: p.part_number, nazwa_detalu: p.name, ilosc: String(p.quantity_right),
    ploter: '', ploter_c: '',
    fkg: '',    fkg_c: '',
    fko: '',    fko_c: '',
    tok: '',    tok_c: '',
    tokcnc: '', tokcnc_c: '',
    fcnc: '',   fcnc_c: '',
    fcnc_robo: '', fcnc_robo_c: '',
    kop1: '', data_wys: '', pozostaly_czas: '', data_zak: '',
  }
}

function prodGodzinyVal(key: string, rows: Row[]): number {
  return rows.reduce((s, r) => {
    const v = parseFloat((r as unknown as Record<string, string>)[key]) || 0
    const q = parseFloat(r.ilosc) || 1
    return s + (v * q) / 60
  }, 0)
}

// ─── Cell ────────────────────────────────────────────────────────────────────

interface CellProps {
  col:       ColDef
  value:     string
  cellColor?: CellColor
  active:    boolean
  rowActive: boolean
  editing:   boolean
  base:      string
  onActivate:      () => void
  onStartEdit:     () => void
  onCommitAndMove: (dr: number, dc: number, val: string) => void
  onCancelEdit:    () => void
}

function Cell({
  col, value, cellColor, active, rowActive, editing, base,
  onActivate, onStartEdit, onCommitAndMove, onCancelEdit,
}: CellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef  = useRef(false)

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
  }, [editing])

  const op = (col.colorKey && cellColor) ? OP_CLR[cellColor as OpColor] : null

  let bg: string
  if (editing)        bg = BG_CELL_ACTIVE
  else if (active)    bg = op ? op.bg : BG_CELL_ACTIVE
  else if (op)        bg = op.bg
  else if (rowActive) bg = BG_ROW_ACTIVE
  else                bg = base

  const textColor = editing ? '#0f172a' : op ? op.text : col.readOnly ? '#475569' : '#0f172a'

  const tdStyle: React.CSSProperties = {
    ...stickyBase(col, bg),
    height: ROW_H, padding: 0,
    borderRight: BORDER, borderBottom: BORDER,
    whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box',
    outline: active && !editing ? `2px solid ${ACTIVE_RING}` : 'none',
    outlineOffset: -2, background: bg,
    transition: 'background 0.07s',
  }

  if (col.readOnly) {
    return (
      <td style={tdStyle} onClick={onActivate}>
        <div style={{ padding: '0 6px', height: ROW_H, display: 'flex', alignItems: 'center', fontSize: 12, color: textColor }}>
          {value}
        </div>
      </td>
    )
  }

  if (editing) {
    return (
      <td style={tdStyle}>
        <input
          ref={inputRef}
          defaultValue={value}
          style={{
            width: '100%', height: ROW_H - 2, padding: '0 6px',
            border: 'none', outline: 'none', fontSize: 12,
            background: BG_CELL_ACTIVE, boxSizing: 'border-box', color: '#0f172a',
          }}
          onKeyDown={e => {
            doneRef.current = false
            const v = e.currentTarget.value
            if (e.key === 'Enter')   { e.preventDefault(); doneRef.current = true; onCommitAndMove(1, 0, v) }
            else if (e.key === 'Tab')    { e.preventDefault(); doneRef.current = true; onCommitAndMove(0, e.shiftKey ? -1 : 1, v) }
            else if (e.key === 'Escape') { e.preventDefault(); doneRef.current = true; onCancelEdit() }
            else if (e.key === 'ArrowDown') { e.preventDefault(); doneRef.current = true; onCommitAndMove(1, 0, v) }
            else if (e.key === 'ArrowUp')   { e.preventDefault(); doneRef.current = true; onCommitAndMove(-1, 0, v) }
            else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === v.length) { e.preventDefault(); doneRef.current = true; onCommitAndMove(0, 1, v) }
            else if (e.key === 'ArrowLeft'  && e.currentTarget.selectionStart === 0)        { e.preventDefault(); doneRef.current = true; onCommitAndMove(0, -1, v) }
          }}
          onBlur={e => { if (doneRef.current) return; onCommitAndMove(0, 0, e.currentTarget.value) }}
        />
      </td>
    )
  }

  return (
    <td style={tdStyle} onClick={onActivate} onDoubleClick={onStartEdit}>
      <div style={{
        padding: '0 6px', height: ROW_H,
        display: 'flex', alignItems: 'center',
        justifyContent: col.colorKey ? 'center' : 'flex-start',
        fontSize: 12, color: textColor,
        fontWeight: op ? 600 : 400,
      }}>
        {value}
      </div>
    </td>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ProductionPlanningPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>()
  const navigate        = useNavigate()
  const decoded         = decodeURIComponent(orderNumber ?? '')

  const [rows,    setRows]    = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [active,  setActive]  = useState<{ r: number; c: number } | null>(null)
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const visibleRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.numer_detalu.toLowerCase().includes(q)   ||
      r.nazwa_detalu.toLowerCase().includes(q)   ||
      r.numer_zlecenia.toLowerCase().includes(q) ||
      r.kop1.toLowerCase().includes(q)
    )
  }, [rows, search])

  useEffect(() => { setActive(null); setEditing(null) }, [search])

  useEffect(() => {
    if (!orderNumber) return
    setLoading(true)
    Promise.all([ordersApi.searchByNumber(decoded), ordersApi.getAll()])
      .then(([summary, orders]) => {
        const order = orders.find(o => o.order_number === decoded)
        if (!order) throw new Error('Nie znaleziono zamówienia')
        return ordersApi.getParts(order.id).then(parts =>
          setRows(parts.map(p => partToRow(p, decoded, formatDate(summary.deadline_at))))
        )
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [orderNumber])

  useEffect(() => {
    if (!active || !containerRef.current) return
    const el  = containerRef.current
    const col = COLS[active.c]
    if (col.stickyIdx === undefined) {
      const l = COL_LEFT[active.c], r = l + col.width
      if (l < el.scrollLeft + STICKY_W) el.scrollLeft = l - STICKY_W
      else if (r > el.scrollLeft + el.clientWidth) el.scrollLeft = r - el.clientWidth
    }
    const thead  = el.querySelector('thead') as HTMLElement | null
    const hh     = thead ? thead.offsetHeight : 30
    const tfootH = TFOOT_H * 2
    const top    = hh + active.r * ROW_H
    const bot    = top + ROW_H
    if (top < el.scrollTop + hh)
      el.scrollTop = top - hh
    else if (bot > el.scrollTop + el.clientHeight - tfootH)
      el.scrollTop = bot - el.clientHeight + tfootH
  }, [active])

  const updateCell = useCallback((rowId: number, key: string, val: string) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [key]: val } : r)), [])

  const setOpColor = useCallback((rowId: number, colorKey: string, clr: CellColor) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [colorKey]: clr } : r)), [])

  const moveTo = useCallback((r: number, c: number) => {
    setActive({
      r: Math.max(0, Math.min(visibleRows.length - 1, r)),
      c: Math.max(0, Math.min(COLS.length - 1, c)),
    })
    setEditing(null)
  }, [visibleRows.length])

  const startEditing = useCallback((r: number, c: number) => {
    if (COLS[c].readOnly) return
    setActive({ r, c }); setEditing({ r, c })
  }, [])

  const cancelEdit = useCallback(() => setEditing(null), [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!active || editing) return
    const { r, c } = active
    const col = COLS[c]
    const row = visibleRows[r]
    if (!row) return

    if (col.colorKey) {
      if (e.key === 'g') { e.preventDefault(); setOpColor(row.id, col.colorKey, 'g'); return }
      if (e.key === 'y') { e.preventDefault(); setOpColor(row.id, col.colorKey, 'y'); return }
      if (e.key === 'r') { e.preventDefault(); setOpColor(row.id, col.colorKey, 'r'); return }
      if (e.key === '0') { e.preventDefault(); setOpColor(row.id, col.colorKey, ''); return }
    }

    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); moveTo(r, c + 1); break
      case 'ArrowLeft':  e.preventDefault(); moveTo(r, c - 1); break
      case 'ArrowDown':  e.preventDefault(); moveTo(r + 1, c); break
      case 'ArrowUp':    e.preventDefault(); moveTo(r - 1, c); break
      case 'Tab':        e.preventDefault(); moveTo(r, e.shiftKey ? c - 1 : c + 1); break
      case 'Enter': case 'F2': e.preventDefault(); startEditing(r, c); break
      case 'Delete': case 'Backspace':
        if (!col.readOnly) {
          e.preventDefault()
          updateCell(row.id, col.key, '')
          if (col.colorKey) setOpColor(row.id, col.colorKey, '')
        }
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !col.readOnly) startEditing(r, c)
    }
  }, [active, editing, moveTo, startEditing, updateCell, setOpColor, visibleRows])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: PAGE_BG }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
        <span style={{ color: '#64748b', fontSize: 13 }}>Ładowanie danych...</span>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: PAGE_BG }}>
      <div style={{ textAlign: 'center', background: '#fff', padding: '32px 40px', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: BORDER_HARD }}>
        <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: 8 }}>Błąd ładowania</p>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>{error}</p>
        <button onClick={() => navigate(`/orders/${orderNumber}`)} style={{ padding: '8px 20px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          ← Powrót
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: PAGE_BG }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 70,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
        background: '#ffffff', borderBottom: BORDER_HARD,
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}>
        <button
          onClick={() => navigate(`/orders/${orderNumber}`)}
          style={{
            position: 'absolute', left: 20,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: BORDER_HARD,
            borderRadius: 8, padding: '7px 14px',
            cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          ← Zamówienie
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <img src="/Logo.png" alt="ProMate" style={{ height: 36, objectFit: 'contain' }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {decoded}
          </span>
        </div>

        <div style={{ position: 'absolute', right: 20 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Szukaj..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 32, paddingRight: 12, height: 36,
                border: BORDER_HARD, borderRadius: 8,
                fontSize: 13, outline: 'none',
                background: '#f8fafc', color: '#0f172a', width: 210,
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = ACTIVE_RING; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)' }}
              onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none' }}
            />
          </div>
        </div>
      </div>

      {/* ── Content (centered) ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', padding: '16px 0 0 0' }}>
        <div style={{ flex: '0 1 auto', maxWidth: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onClick={() => containerRef.current?.focus()}
            style={{
              flex: 1, overflow: 'auto', outline: 'none',
              border: BORDER_HARD,
              borderRadius: '10px 10px 0 0',
              background: '#ffffff',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
              <colgroup>
                {COLS.map(col => <col key={col.key} style={{ width: col.width }} />)}
              </colgroup>

              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  {COLS.map(col => {
                    const sticky = col.stickyIdx !== undefined
                    return (
                      <th key={col.key} style={{
                        ...(sticky ? { position: 'sticky', left: WS_LEFT[col.stickyIdx!], zIndex: 6 } : {}),
                        background: TH_BG,
                        padding: '0 6px', height: 30,
                        borderRight: '1px solid #334155',
                        borderBottom: '1px solid #334155',
                        fontSize: 11, fontWeight: 600, color: TH_TEXT,
                        textAlign: 'center', whiteSpace: 'nowrap',
                        letterSpacing: '0.03em',
                      }}>
                        {col.label}
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row, ri) => {
                  const isRowActive = active?.r === ri
                  const base = ri % 2 === 0 ? ROW_BG_EVEN : ROW_BG_ODD
                  return (
                    <tr key={row.id} style={{ background: isRowActive ? BG_ROW_ACTIVE : base }}>
                      {COLS.map((col, ci) => {
                        const isActive  = isRowActive && active?.c === ci
                        const isEditing = editing?.r === ri && editing?.c === ci
                        const cellColor = col.colorKey
                          ? (row as unknown as Record<string, CellColor>)[col.colorKey]
                          : undefined
                        return (
                          <Cell
                            key={col.key}
                            col={col}
                            value={getCellValue(col, row, ri + 1)}
                            cellColor={cellColor}
                            active={isActive}
                            rowActive={isRowActive}
                            editing={isEditing}
                            base={base}
                            onActivate={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}
                            onStartEdit={() => startEditing(ri, ci)}
                            onCommitAndMove={(dr, dc, v) => {
                              updateCell(row.id, col.key, v)
                              setEditing(null)
                              if (dr || dc) setActive({
                                r: Math.max(0, Math.min(visibleRows.length - 1, ri + dr)),
                                c: Math.max(0, Math.min(COLS.length - 1, ci + dc)),
                              })
                            }}
                            onCancelEdit={cancelEdit}
                          />
                        )
                      })}
                    </tr>
                  )
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length} style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 13 }}>
                      {search ? 'Brak wyników dla „' + search + '"' : 'Brak danych'}
                    </td>
                  </tr>
                )}
              </tbody>

              <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 5 }}>
                <tr>
                  {COLS.map((col, ci) => {
                    const sticky = col.stickyIdx !== undefined
                    let content = ''
                    if (ci === 1)         content = 'Produkcja godziny:'
                    else if (col.colorKey) {
                      const v = prodGodzinyVal(col.key, visibleRows)
                      content = v > 0 ? v.toFixed(2) : ''
                    }
                    return (
                      <td key={col.key} style={{
                        ...(sticky ? { position: 'sticky' as const, left: WS_LEFT[col.stickyIdx!], zIndex: 3 } : {}),
                        background: TFOOT_BG1,
                        padding: '0 6px', height: TFOOT_H,
                        borderRight: BORDER, borderTop: BORDER_HARD,
                        fontSize: 11, fontWeight: ci === 1 ? 600 : 700,
                        color: '#1e293b',
                        textAlign: ci <= 1 ? 'left' : 'center',
                        whiteSpace: 'nowrap',
                      }}>
                        {content}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  {COLS.map((col, ci) => {
                    const sticky = col.stickyIdx !== undefined
                    let content = ''
                    if (ci === 1)         content = 'Produkcja dni:'
                    else if (col.colorKey) {
                      const d = prodGodzinyVal(col.key, visibleRows) / 6
                      content = d > 0 ? d.toFixed(1) : ''
                    }
                    return (
                      <td key={col.key} style={{
                        ...(sticky ? { position: 'sticky' as const, left: WS_LEFT[col.stickyIdx!], zIndex: 3 } : {}),
                        background: TFOOT_BG2,
                        padding: '0 6px', height: TFOOT_H,
                        borderRight: BORDER, borderTop: BORDER,
                        fontSize: 11, fontWeight: ci === 1 ? 600 : 700,
                        color: '#1e293b',
                        textAlign: ci <= 1 ? 'left' : 'center',
                        whiteSpace: 'nowrap',
                      }}>
                        {content}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{
            flexShrink: 0, background: '#ffffff',
            border: BORDER_HARD, borderTop: BORDER,
            borderRadius: '0 0 10px 10px',
            padding: '9px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                {visibleRows.length !== rows.length
                  ? `${visibleRows.length} / ${rows.length} detali`
                  : `${rows.length} ${rows.length === 1 ? 'detal' : 'detali'}`}
              </span>
              <div style={{ width: 1, height: 18, background: '#e2e8f0' }} />
              {(['g', 'y', 'r'] as OpColor[]).map(c => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: OP_CLR[c].bg }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {c === 'g' ? 'OK' : c === 'y' ? 'W trakcie' : 'Problem'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Kolor:{' '}
                {['g','y','r','0'].map(k => (
                  <kbd key={k} style={{ marginLeft: 3, padding: '1px 5px', background: '#f1f5f9', border: BORDER_HARD, borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>{k}</kbd>
                ))}
              </span>
              <button
                style={{ background: '#1e293b', color: 'white', border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.03em' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
              >
                Zatwierdź
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
