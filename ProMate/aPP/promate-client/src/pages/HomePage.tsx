import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersApi, operationLogsApi, OperationLog, cooperationsApi, cooperationLogApi, CooperationLog, operationsApi, Operation, partsApi, phasesApi, PhaseInfo } from '../services/api'
import { PartDetailContent } from './PartDetailPage'

// ─── OP colours ───────────────────────────────────────────────────────────────

type OpState = '' | 'r' | 'o' | 'g' | 'g2'
const OP_CLR: Record<string, { bg: string; text: string }> = {
  r:  { bg: '#ef4444', text: '#fff' },
  o:  { bg: '#f97316', text: '#fff' },
  g:  { bg: '#22c55e', text: '#fff' },
  g2: { bg: '#22c55e', text: '#fff' },  // drugi zielony (po pomarańczowym) — identyczny wygląd
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const OP_KEYS = ['pila','ploter','fkg','fko','tok','tokcnc','fcnc','fcnc_robo','slus'] as const
type OpKey = typeof OP_KEYS[number]
const OP_LABELS: Record<OpKey, string> = {
  pila:'Piła', ploter:'Ploter', fkg:'FKG', fko:'FKO', tok:'TK',
  tokcnc:'TCNC', fcnc:'FCNC', fcnc_robo:'FCNC ROBO', slus:'ŚLUS',
}

// operation_id → klucz kolumny (pila i slus pomijamy — brak time_estimated)
const HOME_OP_MAP: Record<number, string> = {
  1: 'ploter', 2: 'fkg', 3: 'fko',
  4: 'tok',    5: 'tokcnc', 6: 'fcnc', 7: 'fcnc_robo',
}
// klucz kolumny → operation_id
const HOME_OP_ID: Record<string, number> = Object.fromEntries(
  Object.entries(HOME_OP_MAP).map(([id, key]) => [key, Number(id)])
)

// phase_id → kolor; null/brak → 'r' gdy jest czas (domyślnie Oczekuje)
const PHASE_COLOR: Record<number, OpState> = { 16: 'r', 17: 'o', 18: 'g' }
// cykl kolorów: czerwony → pomarańczowy → zielony → czerwony
const COLOR_CYCLE: Record<string, OpState> = { '': 'o', r: 'o', o: 'g', g: 'r', g2: 'r' }
// kolor → phase_id do zapisu w DB (g i g2 to oba Wykonana = 18)
const COLOR_PHASE: Record<string, number>  = { r: 16, o: 17, g: 18, g2: 18 }

// klucze kolumn operacji z czasem (bez piły i ślusa)
const TIMED_OP_KEYS = Object.values(HOME_OP_MAP)  // ploter, fkg, fko, tok, tokcnc, fcnc, fcnc_robo

const N_COLS   = 20
const S_LP     = 0
const S_ZLEC   = 34
const S_TERM   = 184    // 34+150
const S_DETAL  = 304    // +120
const S_NAZWA  = 444    // +140
const S_ILOSC  = 634    // +190
const STICKY_W = 704    // sum of sticky col widths (34+150+120+140+190+70)

// widths of right (non-sticky) columns used in footer table
const OP_W   = 61
const TAIL_W = [80, 80, 80, 100, 85] as const

// ─── Row type ─────────────────────────────────────────────────────────────────

interface Row {
  _key: string; lp: number; part_id: number
  numer_zlecenia: string; termin_wyk: string
  numer_detalu: string; nazwa_detalu: string; ilosc: string
  pila: string; pila_c: OpState; ploter: string; ploter_c: OpState
  fkg: string; fkg_c: OpState; fko: string; fko_c: OpState
  tok: string; tok_c: OpState; tokcnc: string; tokcnc_c: OpState
  fcnc: string; fcnc_c: OpState; fcnc_robo: string; fcnc_robo_c: OpState
  slus: string; slus_c: OpState
  kop1: string; kop1_c: OpState; kop2: string; kop2_c: OpState; kop3: string; kop3_c: OpState
  pozostaly_czas: string; phase_name: string
}

function calcIlosc(p: { quantity_right: number; quantity_left: number }): string {
  if (p.quantity_right === 0) return String(p.quantity_left)
  if (p.quantity_left  === 0) return String(p.quantity_right)
  return `${p.quantity_right}+${p.quantity_left}`
}

function parseIlosc(s: string): number {
  return s.split('+').reduce((sum, part) => sum + (parseFloat(part) || 0), 0)
}

function makeRow(
  key: string, lp: number, partId: number,
  numer_zlecenia: string, termin_wyk: string,
  numer_detalu: string, nazwa_detalu: string, ilosc: string,
): Row {
  return {
    _key: key, lp, part_id: partId, numer_zlecenia, termin_wyk, numer_detalu, nazwa_detalu, ilosc,
    pila:'', pila_c:'', ploter:'', ploter_c:'',
    fkg:'', fkg_c:'', fko:'', fko_c:'',
    tok:'', tok_c:'', tokcnc:'', tokcnc_c:'',
    fcnc:'', fcnc_c:'', fcnc_robo:'', fcnc_robo_c:'', slus:'', slus_c:'',
    kop1:'', kop1_c:'', kop2:'', kop2_c:'', kop3:'', kop3_c:'', pozostaly_czas:'', phase_name:'',
  }
}

const D6_PHASE_ID = 14
const D7_PHASE_ID = 15
const D8_PHASE_ID = 21

const PHASE_LABELS: Record<string, string> = {
  D4:   'Nie wydrukowano',
  D6:   'Gotowe do Prod.',
  D7:   'W trakcie Prod.',
  D8:   'Czeka na Kop.',
  D9:   'W trakcie Kop.',
  D10:  'Skończony',
  D11:  'Wyceniony',
  D100: 'Anulowany',
  D101: 'Wycofany',
  D102: 'Wstrzymany',
}

/** Oblicza nazwę fazy detalu (D6-D10) na podstawie bieżących kolorów w wierszu */
function computePhaseName(row: Row): string {
  const cur = row.phase_name
  if (cur === 'D11' || cur === 'D100' || cur === 'D101' || cur === 'D102') return cur

  const rec = row as unknown as Record<string, string>

  const timedOps    = TIMED_OP_KEYS.filter(k => !!rec[k])
  const doneOps     = timedOps.filter(k => { const c = rec[`${k}_c`] as OpState; return c === 'g' || c === 'g2' })
  const koops       = (['kop1','kop2','kop3'] as const).filter(k => !!rec[k])
  const doneKoops   = koops.filter(k => { const c = rec[`${k}_c`] as OpState; return c === 'g' || c === 'g2' })
  const inProgKoops = koops.filter(k => rec[`${k}_c`] === 'o')

  if (timedOps.length > 0 && doneOps.length === timedOps.length) {
    if (koops.length === 0 || doneKoops.length === koops.length)                               return 'D10'
    if (inProgKoops.length > 0 || (doneKoops.length >= 1 && doneKoops.length < koops.length)) return 'D9'
    return 'D8'
  }

  const hasStarted = timedOps.some(k => {
    const c = rec[`${k}_c`] as OpState
    return c === 'g' || c === 'g2' || c === 'o'
  })
  return hasStarted ? 'D7' : 'D6'
}

/** Oblicza docelową fazę detalu na podstawie statusów operacji */
function computePartPhase(row: Row): number {
  const rec      = row as unknown as Record<string, string>
  const timedOps = TIMED_OP_KEYS.filter(k => !!rec[k])
  const doneOps  = timedOps.filter(k => { const c = rec[`${k}_c`] as OpState; return c === 'g' || c === 'g2' })

  // Wszystkie operacje skończone → minimum D8; D9/D10 ustawia backend
  if (timedOps.length > 0 && doneOps.length === timedOps.length) return D8_PHASE_ID

  const hasStartedOp = timedOps.some(k => {
    const c = rec[`${k}_c`] as OpState
    return c === 'g' || c === 'g2' || c === 'o'
  })
  return hasStartedOp ? D7_PHASE_ID : D6_PHASE_ID
}

/** Suma time_estimated dla operacji z kolorem czerwonym lub pomarańczowym */
function calcPozostaly(row: Row): string {
  let sum = 0
  const rec = row as unknown as Record<string, string>
  for (const k of TIMED_OP_KEYS) {
    const clr = rec[`${k}_c`] as OpState
    if (clr !== 'r' && clr !== 'o') continue
    const t = parseFloat(rec[k] ?? '')
    if (!isNaN(t) && t > 0) sum += t
  }
  return sum > 0 ? (Math.round(sum * 10) / 10).toString() : ''
}

function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' })
  } catch { return s ?? '' }
}

// ─── Style constants ──────────────────────────────────────────────────────────

const BORDER   = '1px solid #d1d5db'
const BG_PAGE  = '#f0f4f8'
const BG_CELL  = '#dbeafe'
const BG_ROW   = '#f0f9ff'
const TH_BG    = '#dbeafe'
const TH_TEXT  = '#1e40af'

function thS(left?: number, isActive = false): React.CSSProperties {
  return {
    background: isActive ? '#93c5fd' : TH_BG, color: TH_TEXT, fontWeight: 700, fontSize: 12,
    padding: '5px 8px', textAlign: 'center', whiteSpace: 'nowrap',
    borderTop: BORDER, borderRight: BORDER, borderBottom: BORDER, borderLeft: 'none',
    position: 'sticky', top: 0, zIndex: left !== undefined ? 6 : 3,
    userSelect: 'none', transition: 'background 0.1s',
    ...(left !== undefined ? { left } : {}),
  }
}

function tdS(isActive: boolean, bg: string, extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: '4px 8px', fontSize: 13,
    borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
    background: bg,
    outline: isActive ? '2px solid #2563eb' : 'none',
    outlineOffset: '-1px',
    textAlign: 'center', whiteSpace: 'nowrap',
    cursor: 'default', minHeight: 30, userSelect: 'none',
    ...extra,
  }
}

function stickyTd(left: number, isActive: boolean, bg: string, extra?: React.CSSProperties): React.CSSProperties {
  return { ...tdS(isActive, bg, extra), position: 'sticky', left, zIndex: 2 }
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v))

// Kolumny z sortowaniem (0-5 = Lp.→Ilość, 18 = Poz. Czas)
const SORTABLE = new Set([0, 1, 2, 3, 4, 5, 18, 19])

// ─── Colgroup shared by main table ────────────────────────────────────────────

function MainColgroup() {
  return (
    <colgroup>
      <col style={{ width: 34 }} />
      <col style={{ width: 150 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 140 }} />
      <col style={{ width: 190 }} />
      <col style={{ width: 70 }} />
      {OP_KEYS.map(k => <col key={k} style={{ width: OP_W }} />)}
      {TAIL_W.map((_, i) => <col key={i} />)}
    </colgroup>
  )
}

// ─── Footer row heights must match table row height ───────────────────────────

const ROW_H        = 34
const FOOTER_ROW_H = 27

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate   = useNavigate()
  const scrollRef  = useRef<HTMLDivElement>(null)

  const [rows,        setRows]       = useState<Row[]>([])
  const [operations,  setOperations] = useState<Operation[]>([])
  const [loading,     setLoading]    = useState(true)
  const [refreshKey,  setRefreshKey] = useState(0)
  const [search,     setSearch]     = useState('')
  const [active,  setActive]  = useState<{ r: number; c: number } | null>(null)

  const [detailPartId, setDetailPartId] = useState<number | null>(null)

  const [sortCol, setSortCol]     = useState<number | null>(null)
  const [sortDir, setSortDir]     = useState<'asc' | 'desc' | null>(null)
  const [colFilters, setColFilters] = useState<Partial<Record<number, string>>>({})
  const [filterCol, setFilterCol]       = useState<number | null>(null)
  const [showFilterRow, setShowFilterRow] = useState(false)
  const filterInputRef = useRef<HTMLInputElement>(null)

  const [partPhases,       setPartPhases]       = useState<PhaseInfo[]>([])
  const [phaseFilter,      setPhaseFilter]      = useState<Set<string>>(() => new Set())
  const [showPhaseFilter,  setShowPhaseFilter]  = useState(false)
  const [phaseDropPos,     setPhaseDropPos]     = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const phaseDropRef    = useRef<HTMLDivElement>(null)
  const phaseDropBtnRef = useRef<HTMLSpanElement>(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [orders, ops, phases] = await Promise.all([
          ordersApi.getAll(),
          operationsApi.getAll().catch(() => [] as Operation[]),
          phasesApi.getByType('part').catch(() => [] as PhaseInfo[]),
        ])
        if (!cancelled) { setOperations(ops); setPartPhases(phases) }
        const phaseMap = new Map(phases.map(ph => [ph.id, ph.name]))

        // Pobierz detale zamówień ze statusem Z3 lub wyższym
        const d3Orders = orders.filter(o => o.phase_id !== null && o.phase_id >= 3)
        const orderParts = await Promise.all(
          d3Orders.map(o => ordersApi.getParts(o.id, 'D3').then(parts => ({ o, parts })))
        )

        // Zbuduj wiersze z zapamiętanym part_id
        const entries: { row: Row; partId: number }[] = []
        for (const { o, parts } of orderParts) {
          // termin z pierwszego detalu (wszystkie detale zamówienia mają ten sam termin)
          const orderDeadline = formatDate(parts[0]?.deadline_at ? String(parts[0].deadline_at) : null)
          for (const p of parts) {
            const row = makeRow(`${o.id}-${p.id}`, 0, p.id, o.order_number,
              orderDeadline, p.part_number, p.name, calcIlosc(p))
            row.phase_name = phaseMap.get(p.phase_id ?? -1) ?? ''
            entries.push({ partId: p.id, row })
          }
        }

        // Załaduj operation_logs i cooperation_logs dla wszystkich detali jednym zapytaniem
        const partIds = entries.map(e => e.partId)
        if (partIds.length > 0) {
          const [logs, coopLogs, cooperations] = await Promise.all([
            operationLogsApi.getByPartIds(partIds).catch(() => [] as OperationLog[]),
            cooperationLogApi.getByPartIds(partIds).catch(() => [] as CooperationLog[]),
            cooperationsApi.getAll().catch(() => [] as { id: number; name: string }[]),
          ])

          // czasy operacji + kolory statusu
          logs.forEach(log => {
            if (log.time_estimated == null) return
            const colKey = HOME_OP_MAP[log.operation_id]
            if (!colKey) return
            const entry = entries.find(e => e.partId === log.part_id)
            if (!entry) return
            const rec = entry.row as unknown as Record<string, unknown>
            rec[colKey] = String(log.time_estimated)
            rec[colKey + '_c'] = PHASE_COLOR[log.phase_id ?? 16] ?? 'r'
          })

          // kooperacje: slot 1/2/3 → kop1/kop2/kop3 + kolory statusu
          coopLogs.forEach(cl => {
            if (cl.slot < 1 || cl.slot > 3) return
            const name = cooperations.find(c => c.id === cl.cooperation_id)?.name ?? ''
            const entry = entries.find(e => e.partId === cl.part_id)
            if (!entry) return
            const rec = entry.row as unknown as Record<string, unknown>
            rec[`kop${cl.slot}`]   = name
            rec[`kop${cl.slot}_c`] = PHASE_COLOR[cl.phase_id ?? 16] ?? 'r'
          })

          // pozostały czas = suma czasów operacji z kolorem r lub o
          entries.forEach(e => {
            e.row.pozostaly_czas = calcPozostaly(e.row)
          })
        }

        if (cancelled) return
        setRows(entries.map(({ row }, i) => ({ ...row, lp: i + 1 })))
      } catch { /* ignoruj */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  // ── Filter ────────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r =>
        r.numer_zlecenia.toLowerCase().includes(q) ||
        r.numer_detalu.toLowerCase().includes(q)   ||
        r.nazwa_detalu.toLowerCase().includes(q)
      )
    : rows

  const COL_FIELDS_SORT: Array<keyof Row> = [
    'lp','numer_zlecenia','termin_wyk','numer_detalu','nazwa_detalu','ilosc',
    'pila','ploter','fkg','fko','tok','tokcnc','fcnc','fcnc_robo','slus',
    'kop1','kop2','kop3','pozostaly_czas','phase_name',
  ]

  // Filtrowanie kolumnowe (Lp.–Ilość = 0-5)
  const FILTER_COLS = new Set([1, 2, 3, 4, 5])
  const colFiltered = Object.entries(colFilters).reduce((acc, [col, val]) => {
    if (!val?.trim()) return acc
    const field = COL_FIELDS_SORT[Number(col)]
    const v = val.toLowerCase()
    return acc.filter(r => String(r[field] ?? '').toLowerCase().includes(v))
  }, filtered)

  const phaseFiltered = phaseFilter.size === 0
    ? colFiltered
    : colFiltered.filter(r => phaseFilter.has(r.phase_name))

  const visible = sortCol !== null && sortDir !== null
    ? [...phaseFiltered].sort((a, b) => {
        const field = COL_FIELDS_SORT[sortCol]
        const va = String(a[field] ?? '')
        const vb = String(b[field] ?? '')
        const numA = parseFloat(va), numB = parseFloat(vb)
        const cmp  = (!isNaN(numA) && !isNaN(numB))
          ? numA - numB
          : va.localeCompare(vb, 'pl', { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : phaseFiltered

  const nRows = visible.length

  // Focusuj właściwy input filtra gdy wiersz się pojawi lub zmieni się aktywna kolumna
  useEffect(() => {
    if (showFilterRow) setTimeout(() => filterInputRef.current?.focus(), 0)
  }, [showFilterRow, filterCol])

  // Zamknij dropdown fazy po kliknięciu poza nim
  useEffect(() => {
    if (!showPhaseFilter) return
    const handle = (e: MouseEvent) => {
      if (!phaseDropRef.current?.contains(e.target as Node) &&
          !phaseDropBtnRef.current?.contains(e.target as Node)) {
        setShowPhaseFilter(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showPhaseFilter])

  const toggleSort = (col: number, e: React.MouseEvent) => {
    if (!SORTABLE.has(col)) return
    e.stopPropagation()
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const openFilter = (col: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setFilterCol(col)
    setShowFilterRow(v => !v || filterCol !== col ? true : false)
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const COL_FIELDS: Array<keyof Row> = [
    'lp','numer_zlecenia','termin_wyk','numer_detalu','nazwa_detalu','ilosc',
    'pila','ploter','fkg','fko','tok','tokcnc','fcnc','fcnc_robo','slus',
    'kop1','kop2','kop3','pozostaly_czas','phase_name',
  ]

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!active) return
    const { r, c } = active
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); setActive({ r, c: clamp(c + 1, N_COLS) }); break
      case 'ArrowLeft':  e.preventDefault(); setActive({ r, c: clamp(c - 1, N_COLS) }); break
      case 'ArrowDown':  e.preventDefault(); setActive({ r: clamp(r + 1, nRows), c });   break
      case 'ArrowUp':    e.preventDefault(); setActive({ r: clamp(r - 1, nRows), c });   break
      case 'Tab':
        e.preventDefault()
        setActive({ r, c: clamp(e.shiftKey ? c - 1 : c + 1, N_COLS) })
        break
      case 'Escape': setActive(null); break
      case ' ': {
        e.preventDefault()
        const row = visible[r]
        if (!row) break
        // kolumny operacji (6–14)
        const opIdx = c - 6
        if (opIdx >= 0 && opIdx < OP_KEYS.length) {
          const k    = OP_KEYS[opIdx]
          const opId = HOME_OP_ID[k]
          if (opId) {
            const val = row[k as keyof Row] as string
            if (val) {
              const clr    = row[`${k}_c` as keyof Row] as OpState
              const newClr = COLOR_CYCLE[clr || 'r']
              setRows(prev => prev.map(ro => {
                if (ro._key !== row._key) return ro
                const updated = { ...ro, [`${k}_c`]: newClr }
                return { ...updated, pozostaly_czas: calcPozostaly(updated), phase_name: computePhaseName(updated) }
              }))
              operationLogsApi.updatePhase(row.part_id, opId, COLOR_PHASE[newClr]).catch(console.error)
              partsApi.updatePhase(row.part_id, computePartPhase({ ...row, [`${k}_c`]: newClr })).catch(console.error)
            }
          }
        }
        // kolumny kooperacji (15–17)
        const kopIdx = c - 15
        if (kopIdx >= 0 && kopIdx <= 2) {
          const f    = (['kop1','kop2','kop3'] as const)[kopIdx]
          const val  = row[f]
          if (val) {
            const clr    = row[`${f}_c` as keyof Row] as OpState
            const newClr = COLOR_CYCLE[clr || 'r']
            const slot   = kopIdx + 1
            setRows(prev => prev.map(ro => {
              if (ro._key !== row._key) return ro
              const updated = { ...ro, [`${f}_c`]: newClr }
              return { ...updated, phase_name: computePhaseName(updated) }
            }))
            cooperationLogApi.updatePhase(row.part_id, slot, COLOR_PHASE[newClr]).catch(console.error)
          }
        }
        break
      }
      case 'c':
        if (e.ctrlKey) {
          e.preventDefault()
          const row = visible[r]
          if (row) navigator.clipboard.writeText(String(row[COL_FIELDS[c]] ?? '')).catch(() => {})
        }
        break
    }
  }, [active, nRows, visible])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !scrollRef.current) return
    const el = scrollRef.current
    const COL_W = [34,150,120,140,190,70,...Array(9).fill(OP_W),...TAIL_W]
    const left  = COL_W.slice(0, active.c).reduce((s, w) => s + w, 0)
    const right = left + COL_W[active.c]

    if (active.c >= 6) {
      if (left  < el.scrollLeft + STICKY_W)             el.scrollLeft = left  - STICKY_W
      else if (right > el.scrollLeft + el.clientWidth)  el.scrollLeft = right - el.clientWidth
    }

    const thead   = el.querySelector('thead') as HTMLElement | null
    const headerH = thead ? thead.offsetHeight : 34
    const rowTop    = headerH + active.r * ROW_H
    const rowBottom = rowTop + ROW_H
    if (rowTop    < el.scrollTop + headerH)             el.scrollTop = rowTop - headerH
    else if (rowBottom > el.scrollTop + el.clientHeight) el.scrollTop = rowBottom - el.clientHeight
  }, [active])

  // ── Totals ────────────────────────────────────────────────────────────────
  function opSum(field: OpKey): number {
    const minutes = visible.reduce((acc, r) => {
      const rec = r as unknown as Record<string, string>
      const clr = rec[`${field}_c`] as OpState
      // tylko czerwony (Oczekuje) i pomarańczowy (W realizacji)
      if (clr !== 'r' && clr !== 'o') return acc
      const v   = parseFloat(rec[field] || '0')
      const qty = parseIlosc(r.ilosc || '1')
      return acc + (isNaN(v) ? 0 : isNaN(qty) ? v : v * qty)
    }, 0)
    return minutes / 60
  }

  function fmt(n: number) { return n > 0 ? +(Math.round(n * 100) / 100) : '' }

  // ─── Shared footer cell style ─────────────────────────────────────────────
  const fCell = (bg: string, color: string): React.CSSProperties => ({
    padding: `0 4px`, textAlign: 'center', fontWeight: 700, fontSize: 13,
    color, background: bg, transition: 'background 0.1s',
    borderRight: BORDER, borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
    height: FOOTER_ROW_H,
  })

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:BG_PAGE, overflow:'hidden' }}>

      {loading ? (
        <>
          <div style={{
            flexShrink:0, background:'#fff', borderBottom:'1px solid #e2e8f0',
            padding:'8px 24px', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <img src="/Logo.png" alt="ProMate" style={{ height:80, objectFit:'contain' }} />
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontSize:14 }}>
            Ładowanie danych…
          </div>
        </>
      ) : (
        <>
          {/* ── Top bar: tabela pełna szerokość + logo absolutnie nałożone ── */}
          <div style={{ flexShrink:0, position:'relative', background:'#fff', overflow:'hidden', paddingLeft:1 }}>
            {/* Logo absolutnie na sticky area */}
            <div style={{
              position:'absolute', left:317, top:0, bottom:0, zIndex:3,
              display:'flex', alignItems:'center', pointerEvents:'none',
              transform:'translateX(-50%)',
            }}>
              <img src="/Logo.png" alt="ProMate" style={{ height:80, objectFit:'contain' }} />
            </div>
            <table style={{ borderCollapse:'separate', borderSpacing:0, tableLayout:'fixed', fontSize:13, width:'100%' }}>
              <MainColgroup />
              <tbody>
                {(() => {
                  const ac = active?.c
                  const labelHl = '#fff'
                  const opBg = (i: number) => ac === 6 + i ? '#eff6ff' : '#fff'
                  return (
                    <>
                      <tr>
                        <td colSpan={6} style={{
                          position:'sticky', left:0, zIndex:2,
                          background: labelHl, transition:'background 0.1s',
                          textAlign:'right', paddingRight:12, fontWeight:700, fontSize:13, color:'#1e40af',
                          borderRight:BORDER, borderTop:'none', borderBottom:'none', borderLeft:'none', height:FOOTER_ROW_H,
                        }}>
                          Produkcja godziny
                        </td>
                        {OP_KEYS.map((k, i) => {
                          const s = opSum(k)
                          return <td key={k} style={fCell(opBg(i), '#1e40af')}>{s > 0 ? +(Math.round(s * 10) / 10) : ''}</td>
                        })}
                      </tr>
                      <tr>
                        <td colSpan={6} style={{
                          position:'sticky', left:0, zIndex:2,
                          background: labelHl, transition:'background 0.1s',
                          textAlign:'right', paddingRight:12, fontWeight:700, fontSize:13, color:'#166534',
                          borderRight:BORDER, borderTop:'none', borderBottom:'none', borderLeft:'none', height:FOOTER_ROW_H,
                        }}>
                          Produkcja dni
                        </td>
                        {OP_KEYS.map((k, i) => {
                          const opId    = HOME_OP_ID[k]
                          const workers = opId ? (operations.find(o => o.id === opId)?.number_of_workers ?? 1) : 1
                          const hours   = opSum(k)
                          // (godziny / (pracownicy * 7.5 h)) / 80%
                          const days    = hours > 0 ? (hours / (workers * 7.5)) / 0.8 : 0
                          return <td key={k} style={fCell(opBg(i), '#166534')}>{days > 0 ? +(Math.round(days * 10) / 10) : ''}</td>
                        })}
                      </tr>
                    </>
                  )
                })()}
              </tbody>
            </table>
          </div>

          {/* ── Main scrollable table ── */}
          <div
            ref={scrollRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onClick={e => { if ((e.target as HTMLElement) === e.currentTarget) setActive(null) }}
            style={{ flex:1, overflow:'auto', outline:'none', background:BG_PAGE, display:'flex', flexDirection:'column', marginTop:0 }}
          >
            {/* Inner wrapper — fills available height */}
            <div style={{
              flex:1, width:'100%', boxSizing:'border-box',
              border:BORDER, borderTop:'none', borderBottom:'none', background:'#fff',
            }}>
              <table style={{ borderCollapse:'separate', borderSpacing:0, tableLayout:'fixed', fontSize:13, width:'100%' }}>
                <MainColgroup />

                <thead style={{ position:'sticky', top:0, zIndex:5 }}>
                  <tr>
                    {([
                      [S_LP,    0,  'Lp.'],
                      [S_ZLEC,  1,  'Numer Zlecenia'],
                      [S_TERM,  2,  'Termin Wyk.'],
                      [S_DETAL, 3,  'Numer Detalu'],
                      [S_NAZWA, 4,  'Nazwa Detalu'],
                      [S_ILOSC, 5,  'Ilość'],
                    ] as [number,number,string][]).map(([left, ci, label]) => {
                      const hasFilter = !!colFilters[ci]?.trim()
                      return (
                        <th key={ci}
                          style={{ ...thS(left, active?.c === ci), cursor:'pointer' }}
                          onClick={e => toggleSort(ci, e)}
                        >
                          <span style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', gap:2 }}>
                            <span style={{ display:'flex', alignItems:'center', gap:3, flex:1, justifyContent:'center' }}>
                              {label}
                              <span style={{ fontSize:10, opacity: sortCol === ci ? 1 : 0.4, color: sortCol === ci ? '#2563eb' : 'inherit' }}>
                                {sortCol === ci ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            </span>
                            {FILTER_COLS.has(ci) && (
                              <span
                                title="Filtruj"
                                onClick={e => openFilter(ci, e)}
                                style={{
                                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                                  padding:'1px 3px', borderRadius:3,
                                  background: hasFilter ? '#2563eb' : 'transparent',
                                  color: hasFilter ? '#fff' : '#94a3b8',
                                  fontSize:10, lineHeight:1, cursor:'pointer', flexShrink:0,
                                }}
                              >▽</span>
                            )}
                          </span>
                        </th>
                      )
                    })}
                    {OP_KEYS.map((k, i) => <th key={k} style={thS(undefined, active?.c === 6 + i)}>{OP_LABELS[k]}</th>)}
                    <th style={thS(undefined, active?.c === 15)}>Kop. 1</th>
                    <th style={thS(undefined, active?.c === 16)}>Kop. 2</th>
                    <th style={thS(undefined, active?.c === 17)}>Kop. 3</th>
                    <th
                      style={{ ...thS(undefined, active?.c === 18), cursor:'pointer' }}
                      onClick={e => toggleSort(18, e)}
                    >
                      <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        Poz. Czas
                        <span style={{ fontSize:10, opacity: sortCol === 18 ? 1 : 0.4, color: sortCol === 18 ? '#2563eb' : 'inherit' }}>
                          {sortCol === 18 ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </span>
                    </th>
                    <th style={{ ...thS(undefined, active?.c === 19), overflow:'visible' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        <span
                          style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}
                          onClick={e => toggleSort(19, e)}
                        >
                          Status
                          <span style={{ fontSize:10, opacity: sortCol === 19 ? 1 : 0.4, color: sortCol === 19 ? '#2563eb' : 'inherit' }}>
                            {sortCol === 19 ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </span>
                        <span
                          ref={phaseDropBtnRef}
                          title="Filtruj status"
                          onClick={e => {
                            e.stopPropagation()
                            setShowPhaseFilter(v => {
                              if (!v && phaseDropBtnRef.current) {
                                const r = phaseDropBtnRef.current.getBoundingClientRect()
                                setPhaseDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                              }
                              return !v
                            })
                          }}
                          style={{
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            padding:'1px 3px', borderRadius:3,
                            background: phaseFilter.size > 0 ? '#2563eb' : 'transparent',
                            color: phaseFilter.size > 0 ? '#fff' : '#94a3b8',
                            fontSize:10, lineHeight:1, cursor:'pointer', flexShrink:0,
                          }}
                        >▽</span>
                      </div>
                      {showPhaseFilter && (() => {
                        const opts = partPhases
                          .filter(p => /^D\d+$/.test(p.name) && [4,6,7,8,9,10,11,100,101,102].includes(parseInt(p.name.slice(1))))
                          .sort((a, b) => parseInt(a.name.slice(1)) - parseInt(b.name.slice(1)))
                        return (
                          <div ref={phaseDropRef} style={{
                            position:'fixed', top: phaseDropPos.top, right: phaseDropPos.right,
                            zIndex:1000, background:'#fff',
                            border:'1px solid #d1d5db', borderRadius:6,
                            boxShadow:'0 4px 12px rgba(0,0,0,.14)',
                            minWidth:140, padding:'4px 0', textAlign:'left',
                          }}>
                            {opts.map(ph => (
                              <label key={ph.id} style={{
                                display:'flex', alignItems:'center', gap:8,
                                padding:'5px 12px', cursor:'pointer', fontSize:13,
                                color:'#111827', whiteSpace:'nowrap', fontWeight:400,
                              }}>
                                <input
                                  type="checkbox"
                                  checked={phaseFilter.has(ph.name)}
                                  onChange={() => setPhaseFilter(prev => {
                                    const s = new Set(prev)
                                    if (s.has(ph.name)) s.delete(ph.name); else s.add(ph.name)
                                    return s
                                  })}
                                />
                                {PHASE_LABELS[ph.name] ?? ph.name}
                              </label>
                            ))}
                            {phaseFilter.size > 0 && (
                              <div style={{ borderTop:'1px solid #e5e7eb', padding:'4px 12px 2px' }}>
                                <button
                                  onClick={() => { setPhaseFilter(new Set()); setShowPhaseFilter(false) }}
                                  style={{ fontSize:11, color:'#6b7280', background:'none', border:'none', cursor:'pointer', padding:0 }}
                                >Wyczyść</button>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </th>
                  </tr>

                  {/* ── Wiersz filtrów inline ───────────────────────────── */}
                  {showFilterRow && (
                    <tr>
                      <td style={{ position:'sticky', left:S_LP, zIndex:4, background:'#eff6ff', borderRight:BORDER, borderBottom:BORDER, padding:'2px 4px' }} />
                      {([
                        [S_ZLEC,  1],
                        [S_TERM,  2],
                        [S_DETAL, 3],
                        [S_NAZWA, 4],
                        [S_ILOSC, 5],
                      ] as [number, number][]).map(([left, ci]) => (
                        <td key={ci} style={{ position:'sticky', left, zIndex:4, background:'#eff6ff', borderRight:BORDER, borderBottom:BORDER, padding:'2px 4px' }}>
                          <input
                            ref={filterCol === ci ? filterInputRef : null}
                            value={colFilters[ci] ?? ''}
                            onChange={e => setColFilters(f => ({ ...f, [ci]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  { setShowFilterRow(false) }
                              if (e.key === 'Escape') { setColFilters(f => { const n={...f}; delete n[ci]; return n }); setShowFilterRow(false) }
                            }}
                            placeholder="Szukaj..."
                            style={{
                              width:'100%', boxSizing:'border-box',
                              border:'1px solid #93c5fd', borderRadius:3,
                              padding:'2px 6px', fontSize:12, outline:'none',
                              background:'#fff',
                            }}
                          />
                        </td>
                      ))}
                      {Array.from({ length: N_COLS - 6 }).map((_, i) => (
                        <td key={i} style={{ background:'#eff6ff', borderRight:BORDER, borderBottom:BORDER }} />
                      ))}
                    </tr>
                  )}
                </thead>

                <tbody>
                  {visible.map((row, ri) => {
                    const isRowActive = active?.r === ri
                    const ca    = (ci: number) => isRowActive && active?.c === ci
                    const rowBg = isRowActive ? BG_ROW : ri % 2 === 0 ? '#fff' : '#f8fafc'
                    const bg    = (ci: number) => ca(ci) ? BG_CELL : rowBg
                    const act   = (ci: number) => ({ onClick: () => setActive({ r: ri, c: ci }) })

                    return (
                      <tr key={row._key}>
                        <td style={stickyTd(S_LP,   ca(0), bg(0), { color:'#94a3b8', fontSize:11 })} {...act(0)}>{row.lp}</td>
                        <td style={stickyTd(S_ZLEC, ca(1), bg(1))} {...act(1)}>{row.numer_zlecenia}</td>
                        <td style={stickyTd(S_TERM, ca(2), bg(2))} {...act(2)}>{row.termin_wyk}</td>
                        <td
                          style={stickyTd(S_DETAL, ca(3), bg(3), { color:'#2563eb', fontWeight:600, cursor:'pointer' })}
                          onClick={e => { e.stopPropagation(); setActive({ r:ri, c:3 }); setDetailPartId(row.part_id) }}
                        >{row.numer_detalu}</td>
                        <td style={stickyTd(S_NAZWA, ca(4), bg(4))} {...act(4)}>{row.nazwa_detalu}</td>
                        <td style={stickyTd(S_ILOSC, ca(5), bg(5))} {...act(5)}>{row.ilosc}</td>

                        {OP_KEYS.map((k, opIdx) => {
                          const ci      = 6 + opIdx
                          const val     = row[k as keyof Row] as string
                          const clr     = row[`${k}_c` as keyof Row] as OpState
                          const cellBg  = clr ? OP_CLR[clr].bg   : bg(ci)
                          const cellTxt = clr ? OP_CLR[clr].text : '#1e293b'
                          const opId = HOME_OP_ID[k]
                          return (
                            <td
                              key={k}
                              style={tdS(ca(ci), cellBg, {
                                color: cellTxt,
                                fontWeight: clr ? 700 : 400,
                                cursor: val && opId ? 'pointer' : undefined,
                              })}
                              {...act(ci)}
                              onDoubleClick={() => {
                                if (!val || !opId) return
                                const newClr = COLOR_CYCLE[clr || 'r']
                                setRows(prev => prev.map(r => {
                                  if (r._key !== row._key) return r
                                  const updated = { ...r, [`${k}_c`]: newClr }
                                  return { ...updated, pozostaly_czas: calcPozostaly(updated), phase_name: computePhaseName(updated) }
                                }))
                                operationLogsApi.updatePhase(row.part_id, opId, COLOR_PHASE[newClr]).catch(console.error)
                                partsApi.updatePhase(row.part_id, computePartPhase({ ...row, [`${k}_c`]: newClr })).catch(console.error)
                              }}
                            >
                              {val}
                            </td>
                          )
                        })}

                        {(['kop1','kop2','kop3'] as const).map((f, i) => {
                          const ci   = 15 + i
                          const val  = row[f]
                          const clr  = row[`${f}_c` as keyof Row] as OpState
                          const slot = i + 1
                          const cellBg  = clr ? OP_CLR[clr].bg   : bg(ci)
                          const cellTxt = clr ? OP_CLR[clr].text : '#1e293b'
                          return (
                            <td
                              key={f}
                              style={tdS(ca(ci), cellBg, {
                                color: cellTxt,
                                fontWeight: clr ? 700 : 400,
                                cursor: val ? 'pointer' : undefined,
                              })}
                              {...act(ci)}
                              onDoubleClick={() => {
                                if (!val) return
                                const newClr = COLOR_CYCLE[clr || 'r']
                                setRows(prev => prev.map(ro => {
                                  if (ro._key !== row._key) return ro
                                  const updated = { ...ro, [`${f}_c`]: newClr }
                                  return { ...updated, phase_name: computePhaseName(updated) }
                                }))
                                cooperationLogApi.updatePhase(row.part_id, slot, COLOR_PHASE[newClr]).catch(console.error)
                              }}
                            >
                              {val}
                            </td>
                          )
                        })}
                        {(['pozostaly_czas','phase_name'] as Array<keyof Row>).map((f, i) => {
                          const ci  = 18 + i
                          const val = row[f] as string
                          const disp = f === 'phase_name' ? (PHASE_LABELS[val] ?? val) : val
                          return <td key={String(f)} style={tdS(ca(ci), bg(ci))} {...act(ci)}>{disp}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Panel detalu (pełny overlay) ─────────────────────────────── */}
      {detailPartId && (
        <div style={{ position: 'fixed', top: 0, left: 56, right: 0, bottom: 0, zIndex: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PartDetailContent
            part_id={detailPartId}
            onClose={() => { setDetailPartId(null); setRefreshKey(k => k + 1) }}
            onOperationTimeUpdated={(partId, operationId, time) => {
              const colKey = HOME_OP_MAP[operationId]
              if (!colKey) return
              setRows(prev => prev.map(row =>
                row.part_id !== partId ? row : { ...row, [colKey]: time != null ? String(time) : '' } as typeof row
              ))
            }}
          />
        </div>
      )}

    </div>
  )
}
