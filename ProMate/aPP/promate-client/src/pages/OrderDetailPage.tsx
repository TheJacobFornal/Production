import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cooperation, cooperationLogApi, cooperationsApi, formLogApi, Material, materialsApi, Operation, operationLogsApi, operationsApi, partsApi, PartWithOrder, priceApi } from '../services/api'

// ─── Kolory grup ──────────────────────────────────────────────────────────────

const GROUP_BG        = { base: '#dbeafe', operacje: '#ffedd5', wymiary: '#f3e8ff', koszty: '#dcfce7' } as const
const GROUP_BG_ACTIVE = { base: '#93c5fd', operacje: '#fdba74', wymiary: '#d8b4fe', koszty: '#86efac' } as const
const GROUP_TEXT      = { base: '#1e40af', operacje: '#9a3412', wymiary: '#6b21a8', koszty: '#166534' } as const
type Group = keyof typeof GROUP_BG

// ─── Definicje kolumn ─────────────────────────────────────────────────────────

const W        = 90
const WN       = 54
const WS       = [48, 140, 150, 150, 60]
const WS_LEFT  = WS.reduce<number[]>((acc, _, i) =>
  [...acc, i === 0 ? 0 : acc[i - 1] + WS[i - 1]], [])
const STICKY_W = WS.reduce((s, w) => s + w, 0)

const BORDER = '1px solid #d1d5db'

interface ColDef {
  key:        string
  label:      string
  group:      Group
  readOnly?:  boolean
  stickyIdx?: number
  width:      number
}

const COLS: ColDef[] = [
  { key: 'lp',             label: 'Lp.',            group: 'base',     readOnly: true, stickyIdx: 0, width: WS[0] },
  { key: 'numer_zlecenia', label: 'Numer Zlecenia',  group: 'base',     readOnly: true, stickyIdx: 1, width: WS[1] },
  { key: 'numer_detalu',   label: 'Numer Detalu',    group: 'base',     stickyIdx: 2,  width: WS[2] },
  { key: 'nazwa_detalu',   label: 'Nazwa Detalu',    group: 'base',     stickyIdx: 3,  width: WS[3] },
  { key: 'ilosc',          label: 'Ilość',           group: 'base',     stickyIdx: 4,  width: WS[4] },
  { key: 'kop1',           label: 'Kop. 1',          group: 'operacje', width: W  },
  { key: 'kop2',           label: 'Kop. 2',          group: 'operacje', width: W  },
  { key: 'kop3',           label: 'Kop. 3',          group: 'operacje', width: W  },
  { key: 'pila',           label: 'Piła',            group: 'operacje', width: WN },
  { key: 'ploter',         label: 'Ploter',          group: 'operacje', width: WN },
  { key: 'fk',             label: 'FK',              group: 'operacje', width: WN },
  { key: 'tk',             label: 'TK',              group: 'operacje', width: WN },
  { key: 'fcnc2',          label: 'FCNC',            group: 'operacje', width: WN },
  { key: 'tcnc',           label: 'TCNC',            group: 'operacje', width: WN },
  { key: 'szlif',          label: 'SZLIF',           group: 'operacje', width: WN },
  { key: 'spaw',           label: 'SPAW',            group: 'operacje', width: WN },
  { key: 'slus',           label: 'ŚLUS',            group: 'operacje', width: WN },
  { key: 'total',          label: 'Total',           group: 'operacje', readOnly: true, width: W  },
  { key: 'material',       label: 'Materiał',        group: 'wymiary',  width: W  },
  { key: 'a',              label: 'A',               group: 'wymiary',  width: WN },
  { key: 'b',              label: 'B',               group: 'wymiary',  width: WN },
  { key: 'c_col',          label: 'C',               group: 'wymiary',  width: WN },
  { key: 'sr',             label: 'Śr.',             group: 'wymiary',  width: WN },
  { key: 'dl',             label: 'Dł.',             group: 'wymiary',  width: WN },
  { key: 'masa_szt',       label: 'Masa szt.',       group: 'wymiary',  readOnly: true, width: W  },
  { key: 'masa_kpl',       label: 'Masa kpl',        group: 'wymiary',  readOnly: true, width: W  },
  { key: 'pow_szt',        label: 'Pow. obr. szt.',  group: 'wymiary',  readOnly: true, width: W  },
  { key: 'pow_kpl',        label: 'Pow. obr. kpl',   group: 'wymiary',  readOnly: true, width: W  },
  { key: 'handlowka',      label: 'Handlówka kpl',   group: 'koszty',   width: W  },
  { key: 'cena_koop',      label: 'Cena koop.',      group: 'koszty',   readOnly: true, width: W  },
  { key: 'marza',          label: 'Marża',           group: 'koszty',   width: W  },
  { key: 'kwota_rbh',      label: 'Kwota rbh',       group: 'koszty',   readOnly: true, width: W  },
  { key: 'suma_obrobki',   label: 'Suma obróbki',    group: 'koszty',   readOnly: true, width: W  },
  { key: 'material_szt',   label: 'Materiał szt.',   group: 'koszty',   readOnly: true, width: W  },
  { key: 'material_kpl',   label: 'Materiał kpl',    group: 'koszty',   readOnly: true, width: W  },
  { key: 'cena_kpl',       label: 'Cena kpl.',       group: 'koszty',   readOnly: true, width: W  },
  { key: 'cena_szt',       label: 'Cena szt.',       group: 'koszty',   readOnly: true, width: W  },
]

const COL_LEFT = COLS.reduce<number[]>((acc, _, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + COLS[i - 1].width)
  return acc
}, [])

const GROUPS = (['base', 'operacje', 'wymiary', 'koszty'] as Group[]).map(g => ({
  group: g,
  label: g === 'base' ? 'Podstawowe' : g === 'operacje' ? 'Operacje' : g === 'wymiary' ? 'Wymiary / Materiały' : 'Koszty',
  count: COLS.filter(c => c.group === g).length,
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OP_TIME_KEYS = ['pila','ploter','fk','tk','fcnc2','tcnc','szlif','spaw','slus']

// klucz kolumny → nazwa operacji w DB
const OP_KEY_TO_NAME: Record<string, string> = {
  pila:   'PIŁA',
  ploter: 'PLOTER',
  fk:     'FKG',
  tk:     'TOK',
  fcnc2:  'FCNC',
  tcnc:   'TOKCNC',
  szlif:  'SZLIF',
  spaw:   'SPAW',
  slus:   'ŚLUSARNIA',
}

// nazwa operacji w DB → klucz kolumny (odwrotność OP_KEY_TO_NAME)
const OP_NAME_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(OP_KEY_TO_NAME).map(([k, v]) => [v, k])
)

function calcMass(row: Row, materials: Material[]): string {
  const rec     = row as unknown as Record<string, string>
  const density = materials.find(m => m.name === rec['material'])?.density
  if (!density) return ''

  const sr = parseFloat(rec['sr'] || '0')
  const dl = parseFloat(rec['dl'] || '0')
  if (sr > 0 && dl > 0) {
    // walec: π × (Śr/2)² × Dł / 1 000 000 × gęstość
    const mass = Math.PI * Math.pow(sr / 2, 2) * dl / 1_000_000 * density
    return String(Math.round(mass * 100) / 100)
  }

  const a = parseFloat(rec['a']     || '0')
  const b = parseFloat(rec['b']     || '0')
  const c = parseFloat(rec['c_col'] || '0')
  if (a > 0 && b > 0 && c > 0) {
    // prostopadłościan: A × B × C / 1 000 000 × gęstość
    const mass = (a * b * c) / 1_000_000 * density
    return String(Math.round(mass * 100) / 100)
  }

  return ''
}

function calcPowSzt(row: Row): string {
  const rec = row as unknown as Record<string, string>

  const sr = parseFloat(rec['sr'] || '0')
  const dl = parseFloat(rec['dl'] || '0')
  if (sr > 0 && dl > 0) {
    // walec: powierzchnia boczna + 2 podstawy
    const area = Math.PI * sr * dl + 2 * Math.PI * Math.pow(sr / 2, 2)
    return String(Math.round(area / 10_000 * 100) / 100)
  }

  const a = parseFloat(rec['a']     || '0')
  const b = parseFloat(rec['b']     || '0')
  const c = parseFloat(rec['c_col'] || '0')
  if (a > 0 && b > 0 && c > 0) {
    // graniastosłup: suma wszystkich 6 ścian
    const area = 2 * (a * b + b * c + a * c)
    return String(Math.round(area / 10_000 * 100) / 100)
  }

  return ''
}

function calcKopCost(
  row:          Row,
  kopName:      string,
  cooperations: Cooperation[],
  materials:    Material[],
): number | null {
  if (!kopName) return null
  const coop = cooperations.find(c => c.name === kopName)
  if (!coop?.price) return null

  if (coop.unit === 'szt') {
    return Math.round(coop.price * 100) / 100
  }
  if (coop.unit === 'kg') {
    const mass = parseFloat(calcMass(row, materials))
    if (!mass || isNaN(mass)) return null
    return Math.round(coop.price * mass * 100) / 100
  }
  if (coop.unit === 'dm2') {
    const area = parseFloat(calcPowSzt(row))
    if (!area || isNaN(area)) return null
    return Math.round(coop.price * area * 100) / 100
  }
  return null
}

function calcCenaKoop(row: Row, cooperations: Cooperation[], materials: Material[]): string {
  const rec = row as unknown as Record<string, string>
  let sum = 0
  for (const slot of [1, 2, 3] as const) {
    const kopName = rec[`kop${slot}`]
    if (!kopName) continue
    const cost = calcKopCost(row, kopName, cooperations, materials)
    if (cost != null) sum += cost
  }
  return sum > 0 ? String(Math.round(sum * 100) / 100) : ''
}

function calcTotal(row: Row): string {
  const sum = OP_TIME_KEYS.reduce((acc, k) => {
    const v = parseFloat((row as unknown as Record<string, string>)[k] || '0')
    return acc + (isNaN(v) ? 0 : v)
  }, 0)
  return sum > 0 ? String(Math.round(sum * 10) / 10) : ''
}

function calcMaterialSzt(row: Row, materials: Material[]): string {
  const rec  = row as unknown as Record<string, string>
  const mat  = materials.find(m => m.name === rec['material'])
  if (!mat?.cost) return ''
  const mass = parseFloat(calcMass(row, materials))
  if (!mass || isNaN(mass)) return ''
  return String(Math.round(mass * mat.cost * 100) / 100)
}

function calcKwotaRbh(row: Row, operations: Operation[]): string {
  const rec = row as unknown as Record<string, string>
  let sum = 0
  for (const key of OP_TIME_KEYS) {
    const minutes = parseFloat(rec[key] || '0')
    if (!minutes || isNaN(minutes)) continue
    const opName   = OP_KEY_TO_NAME[key]
    const hourCost = operations.find(o => o.name === opName)?.hour_cost
    if (!hourCost) continue
    sum += (minutes / 60) * hourCost
  }
  return sum > 0 ? String(Math.round(sum * 100) / 100) : ''
}

function stickyTdBase(col: ColDef, bg: string): React.CSSProperties {
  if (col.stickyIdx === undefined) return {}
  return { position: 'sticky', left: WS_LEFT[col.stickyIdx], zIndex: 2, background: bg }
}

// ─── Row ─────────────────────────────────────────────────────────────────────

type Row = Record<string, string>

function calcIlosc(p: PartWithOrder): string {
  if (p.quantity_right === 0) return String(p.quantity_left)
  if (p.quantity_left  === 0) return String(p.quantity_right)
  return `${p.quantity_right}+${p.quantity_left}`
}

function parseIlosc(s: string): number {
  return s.split('+').reduce((sum, part) => sum + (parseFloat(part) || 0), 0)
}

function partToRow(p: PartWithOrder, orderNumber: string): Row {
  return {
    _id:            String(p.id),
    lp:             '',
    numer_zlecenia: orderNumber,
    numer_detalu:   p.part_number,
    nazwa_detalu:   p.name,
    ilosc:          calcIlosc(p),
    kop1: '', kop2: '', kop3: '',
    pila: '', ploter: '', fk: '', tk: '', fcnc2: '', tcnc: '', szlif: '', spaw: '', slus: '', total: '',
    material: '', a: '', b: '', c_col: '', sr: '', dl: '', masa_szt: '', masa_kpl: '', pow_szt: '', pow_kpl: '',
    handlowka: '', cena_koop: '', marza: '1.2', kwota_rbh: '', suma_obrobki: '', material_kpl: '', cena_kpl: '', cena_szt: '',
  }
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

const BG_CELL_ACTIVE = '#dbeafe'
const BG_ROW_ACTIVE  = '#f0f9ff'

interface CellProps {
  col:             ColDef
  value:           string
  active:          boolean
  rowActive:       boolean
  editing:         boolean
  onChange:        (v: string) => void
  onActivate:      () => void
  onStartEdit:     () => void
  onCommitAndMove: (dr: number, dc: number, val: string) => void
  onCancelEdit:    () => void
  onNavigate?:     () => void
}

function Cell({ col, value, active, rowActive, editing, onChange, onActivate, onStartEdit, onCommitAndMove, onCancelEdit, onNavigate }: CellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef  = useRef(false)

  useEffect(() => {
    if (editing && inputRef.current) {
      doneRef.current = false
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const stickyBg = active ? BG_CELL_ACTIVE : rowActive ? BG_ROW_ACTIVE : '#ffffff'
  const sticky   = stickyTdBase(col, stickyBg)

  const tdStyle: React.CSSProperties = {
    minWidth: col.width, maxWidth: col.width, width: col.width,
    padding: 0,
    outline:      active ? '2px solid #2563eb' : 'none',
    outlineOffset: '-1px',
    borderRight:  BORDER, borderBottom: BORDER,
    borderTop: 'none', borderLeft: 'none',
    ...sticky,
    ...(col.stickyIdx === undefined ? { background: active ? BG_CELL_ACTIVE : 'transparent' } : {}),
  }

  const commit = (dr: number, dc: number, v: string) => {
    doneRef.current = true
    onChange(v)
    onCommitAndMove(dr, dc, v)
  }

  return (
    <td style={tdStyle} onClick={onActivate} onDoubleClick={() => !col.readOnly && onStartEdit()}>
      {editing && !col.readOnly ? (
        <input
          ref={inputRef}
          defaultValue={value}
          onBlur={e => { if (!doneRef.current) commit(0, 0, e.target.value) }}
          onKeyDown={e => {
            const v   = (e.target as HTMLInputElement).value
            const pos = (e.target as HTMLInputElement).selectionStart ?? 0
            const sel = (e.target as HTMLInputElement).selectionEnd   ?? 0
            switch (e.key) {
              case 'Enter':     e.preventDefault(); commit(0, 1, v); break
              case 'Tab':       e.preventDefault(); commit(0, e.shiftKey ? -1 : 1, v); break
              case 'ArrowDown': e.preventDefault(); commit(1, 0, v); break
              case 'ArrowUp':   e.preventDefault(); commit(-1, 0, v); break
              case 'ArrowRight':
                if (pos === v.length && pos === sel) { e.preventDefault(); commit(0, 1, v) }
                break
              case 'ArrowLeft':
                if (pos === 0 && sel === 0) { e.preventDefault(); commit(0, -1, v) }
                break
              case 'Escape':
                e.preventDefault()
                doneRef.current = true
                onCancelEdit()
                break
            }
          }}
          style={{
            width: '100%', minWidth: 0, boxSizing: 'border-box',
            padding: '2px 6px', border: 'none', outline: 'none',
            textAlign: 'center', fontSize: 13, background: '#dbeafe',
          }}
        />
      ) : (
        <div
          onClick={onNavigate ? e => { e.stopPropagation(); onNavigate() } : undefined}
          style={{
            padding: '4px 8px', textAlign: 'center', fontSize: 13,
            whiteSpace: 'nowrap', overflow: 'hidden',
            userSelect: 'none',
            cursor: onNavigate ? 'pointer' : 'default',
            color: onNavigate ? '#2563eb' : 'inherit',
            fontWeight: onNavigate ? 600 : 400,
            minHeight: 30, lineHeight: '22px',
          }}
        >
          {value || ' '}
        </div>
      )}
    </td>
  )
}

// ─── MatCell ──────────────────────────────────────────────────────────────────

interface MatCellProps {
  value:      string
  materials:  Material[]
  active:     boolean
  rowActive:  boolean
  onActivate: () => void
  onUpdate:   (name: string) => void
}

function MatCell({ value, materials, active, rowActive, onActivate, onUpdate }: MatCellProps) {
  const bg = active ? '#d8b4fe' : rowActive ? '#faf5ff' : '#fff'

  return (
    <td style={{
      minWidth: W, maxWidth: W, width: W, padding: 0,
      borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
      outline: active ? '2px solid #7c3aed' : 'none', outlineOffset: -1,
      background: bg, boxSizing: 'border-box',
    }} onClick={onActivate}>
      <select
        value={value}
        onChange={e => { e.stopPropagation(); onUpdate(e.target.value) }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); e.stopPropagation(); onUpdate('')
          }
        }}
        style={{
          width: '100%', height: 29,
          border: 'none', outline: 'none', fontSize: 12,
          background: value ? '#f5f3ff' : bg,
          color: value ? '#6b21a8' : '#9ca3af',
          fontWeight: value ? 600 : 400,
          padding: '0 6px', cursor: 'pointer',
        }}
      >
        <option value="">—</option>
        {materials.map(m => (
          <option key={m.id} value={m.name}
            style={{
              background: m.name === value ? '#ede9fe' : '#fff',
              color:      m.name === value ? '#6b21a8' : '#0f172a',
              fontWeight: m.name === value ? 700 : 400,
            }}
          >
            {m.name}
          </option>
        ))}
      </select>
    </td>
  )
}

// ─── KopCell ──────────────────────────────────────────────────────────────────

interface KopCellProps {
  value:        string
  cooperations: Cooperation[]
  active:       boolean
  rowActive:    boolean
  onActivate:   () => void
  onUpdate:     (name: string) => void
}

function KopCell({ value, cooperations, active, rowActive, onActivate, onUpdate }: KopCellProps) {
  const bg = active ? GROUP_BG_ACTIVE.operacje : rowActive ? '#fff7ed' : '#fff'
  const available = cooperations.filter(c => c.price != null && c.unit)
  return (
    <td style={{
      minWidth: W, maxWidth: W, width: W, padding: 0,
      borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
      outline: active ? `2px solid ${GROUP_TEXT.operacje}` : 'none', outlineOffset: -1,
      background: bg, boxSizing: 'border-box',
    }} onClick={onActivate}>
      <select
        value={value}
        onChange={e => { e.stopPropagation(); onUpdate(e.target.value) }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); e.stopPropagation(); onUpdate('')
          }
        }}
        style={{
          width: '100%', height: 29,
          border: 'none', outline: 'none', fontSize: 12,
          background: value ? '#fff7ed' : bg,
          color: value ? GROUP_TEXT.operacje : '#9ca3af',
          fontWeight: value ? 600 : 400,
          padding: '0 6px', cursor: 'pointer',
        }}
      >
        <option value="">—</option>
        {available.map(c => (
          <option key={c.id} value={c.name}
            style={{
              background: c.name === value ? '#fff7ed' : '#fff',
              color:      c.name === value ? GROUP_TEXT.operacje : '#0f172a',
              fontWeight: c.name === value ? 700 : 400,
            }}
          >
            {c.name}
          </option>
        ))}
      </select>
    </td>
  )
}

const KOP_SLOT: Record<string, number> = { kop1: 1, kop2: 2, kop3: 3 }

// ─── Strona ───────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const navigate = useNavigate()
  const [rows,      setRows]      = useState<Row[]>([])
  const [materials,     setMaterials]     = useState<Material[]>([])
  const [cooperations,  setCooperations]  = useState<Cooperation[]>([])
  const [operations,    setOperations]    = useState<Operation[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [active,  setActive]  = useState<{ r: number; c: number } | null>(null)
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null)

  const [colFilters,     setColFilters]     = useState<Partial<Record<number, string>>>({})
  const [showFilterRow,  setShowFilterRow]  = useState(false)
  const [filterCol,      setFilterCol]      = useState<number | null>(null)
  const filterInputRef = useRef<HTMLInputElement>(null)

  const [sortCol,  setSortCol]  = useState<number | null>(null)
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc' | null>(null)

  // Wybór kolumn
  const [hiddenColKeys,  setHiddenColKeys]  = useState<Set<string>>(new Set())
  const [showColPicker,  setShowColPicker]  = useState(false)
  const [draftHidden,    setDraftHidden]    = useState<Set<string>>(new Set())

  const containerRef        = useRef<HTMLDivElement>(null)
  const savedCostsRef       = useRef<Map<string, number | null>>(new Map())
  const savedFormCostsRef   = useRef<Map<number, string>>(new Map())
  const savedCostKitRef     = useRef<Map<number, number | null>>(new Map())
  const materialsRef        = useRef<Material[]>([])
  const operationsRef       = useRef<Operation[]>([])

  // Kolumny z filtrem i sortowaniem (0–4 = Lp. → Ilość, zawsze widoczne)
  const FILTER_COLS   = new Set([1, 2, 3, 4])
  const SORTABLE_COLS = new Set([0, 1, 2, 3, 4])

  // Szerokość kontenera (do skalowania kolumn)
  const [contW, setContW] = useState(0)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContW(el.clientWidth)
    const obs = new ResizeObserver(([e]) => setContW(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading])

  // Widoczne kolumny (sticky zawsze widoczne)
  const visibleCols = COLS.filter(c => c.stickyIdx !== undefined || !hiddenColKeys.has(c.key))

  // Skalowane szerokości: sticky = stałe, niesticky = proporcjonalne do dostępnej przestrzeni
  const visNonSticky    = visibleCols.filter(c => c.stickyIdx === undefined)
  const nonStickyNat    = visNonSticky.reduce((s, c) => s + c.width, 0)
  // Odejmujemy 2px (lewy+prawy border wewnętrznego diva) żeby uniknąć przepełnienia
  const innerW          = contW > 2 ? contW - 2 : contW
  const availForNonSt   = innerW > STICKY_W ? Math.max(innerW - STICKY_W, nonStickyNat) : nonStickyNat
  // Math.floor + reszta do ostatniej kolumny — bez zaokrąglania w górę
  const visColWidthsRaw = visibleCols.map(col =>
    col.stickyIdx !== undefined
      ? col.width
      : nonStickyNat > 0 ? Math.floor(col.width * availForNonSt / nonStickyNat) : col.width
  )
  const nsSum           = visColWidthsRaw.reduce((s, w, i) => visibleCols[i].stickyIdx === undefined ? s + w : s, 0)
  const nsRemainder     = availForNonSt - nsSum
  const lastNSIdx       = visibleCols.map((c, i) => c.stickyIdx === undefined ? i : -1).filter(i => i >= 0).at(-1) ?? 0
  const visColWidths    = visColWidthsRaw.map((w, i) => i === lastNSIdx ? w + nsRemainder : w)
  const visColLeft  = visColWidths.reduce<number[]>((acc, _w, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + visColWidths[i - 1])
    return acc
  }, [])
  const visGroups = (['base', 'operacje', 'wymiary', 'koszty'] as Group[]).map(g => ({
    group: g,
    label: g === 'base' ? 'Podstawowe' : g === 'operacje' ? 'Operacje' : g === 'wymiary' ? 'Wymiary / Materiały' : 'Koszty',
    count: visibleCols.filter(c => c.group === g).length,
  })).filter(g => g.count > 0)

  // ── Ładowanie materiałów i kooperacji ────────────────────────────────────
  useEffect(() => {
    materialsApi.getAll().then(m => { setMaterials(m); materialsRef.current = m }).catch(console.error)
    cooperationsApi.getAll().then(setCooperations).catch(console.error)
    operationsApi.getAll().then(ops => { setOperations(ops); operationsRef.current = ops }).catch(console.error)
  }, [])

  // ── Auto-zapis ceny kooperacji gdy zmieniają się wymiary/materiał/kop ────
  useEffect(() => {
    if (!cooperations.length || !materials.length) return
    for (const row of rows) {
      for (const slot of [1, 2, 3] as const) {
        const kopName = (row as unknown as Record<string, string>)[`kop${slot}`]
        if (!kopName) continue
        const cost    = calcKopCost(row, kopName, cooperations, materials)
        const cacheKey = `${row._id}-${slot}`
        const prev    = savedCostsRef.current.get(cacheKey)
        if (cost !== prev) {
          savedCostsRef.current.set(cacheKey, cost)
          cooperationLogApi.updateCost(Number(row._id), slot, cost).catch(console.error)
        }
      }
    }
  }, [rows, cooperations, materials])

  // ── Auto-zapis cost_kit (Materiał kpl) do form_log ───────────────────────
  useEffect(() => {
    if (!materials.length) return
    for (const row of rows) {
      const partId  = Number(row._id)
      const matSzt  = parseFloat(calcMaterialSzt(row, materials) || '0')
      const qty     = parseIlosc(row['ilosc'] || '0')
      const costKit = matSzt && qty ? Math.round(matSzt * qty * 100) / 100 : null
      const prev    = savedCostKitRef.current.get(partId)
      if (prev === costKit) continue
      savedCostKitRef.current.set(partId, costKit)
      formLogApi.updateCostKit(partId, costKit).catch(console.error)
    }
  }, [rows, materials])

  // ── Auto-zapis kosztów kalkulacyjnych ────────────────────────────────────
  useEffect(() => {
    if (!materials.length || !operations.length) return
    for (const row of rows) {
      const partId        = Number(row._id)
      const kwotaRbh      = calcKwotaRbh(row, operations)
      const cenaKoop      = calcCenaKoop(row, cooperations, materials)
      const sumaObrob     = !kwotaRbh ? '' : (() => {
        const sum = parseFloat(kwotaRbh || '0') + parseFloat(cenaKoop || '0')
        return sum > 0 ? String(Math.round(sum * 100) / 100) : ''
      })()
      const materialSzt   = calcMaterialSzt(row, materials)
      const materialKpl   = (() => {
        const szt = parseFloat(materialSzt || '0')
        const qty = parseIlosc(row['ilosc'] || '0')
        return szt && qty ? String(Math.round(szt * qty * 100) / 100) : ''
      })()
      const handlowka     = (row as unknown as Record<string, string>)['handlowka'] || ''
      const cenaKpl       = (() => {
        const sum = parseFloat(handlowka || '0') + parseFloat(sumaObrob || '0') + parseFloat(materialKpl || '0')
        return sum > 0 ? String(Math.round(sum * 100) / 100) : ''
      })()
      const cenaSzt       = (() => {
        const kpl = parseFloat(cenaKpl || '0')
        const qty = parseIlosc(row['ilosc'] || '0')
        return kpl && qty ? String(Math.round(kpl / qty * 100) / 100) : ''
      })()

      const cacheVal = `${kwotaRbh}|${cenaKoop}|${sumaObrob}|${cenaKpl}|${cenaSzt}|${handlowka}`
      if (savedFormCostsRef.current.get(partId) === cacheVal) continue
      savedFormCostsRef.current.set(partId, cacheVal)

      const n = (v: string) => v ? parseFloat(v) : null
      priceApi.upsert({
        part_id:             partId,
        cost_commercial_kit: n(handlowka),
        cost_labor_hour:     n(kwotaRbh),
        cost_cooperation:    n(cenaKoop),
        cost_machining:      n(sumaObrob),
        price_kit:           n(cenaKpl),
        price_piece:         n(cenaSzt),
      }).catch(console.error)
    }
  }, [rows, cooperations, materials, operations])

  // ── Ładowanie wszystkich detali ze wszystkich zamówień ────────────────────
  useEffect(() => {
    setLoading(true)
    partsApi.getAllInPhase('D10', 'D11')
      .then(parts => parts.map(p => partToRow(p, p.order_number)))
      .then(async flat => {
        const partIds = flat.map(r => Number(r._id))
        const [coops, copLogs, formLogs, opLogs, ops, prices] = await Promise.all([
          cooperationsApi.getAll(),
          partIds.length ? cooperationLogApi.getByPartIds(partIds)  : Promise.resolve([]),
          partIds.length ? formLogApi.getByPartIds(partIds)         : Promise.resolve([]),
          partIds.length ? operationLogsApi.getByPartIds(partIds)   : Promise.resolve([]),
          operationsApi.getAll(),
          partIds.length ? priceApi.getByPartIds(partIds)           : Promise.resolve([]),
        ])
        if (!operationsRef.current.length) { setOperations(ops); operationsRef.current = ops }

        // kooperacje
        const coopMap = new Map(coops.map(c => [c.id, c.name]))
        const logMap  = new Map<number, Record<string, string>>()
        for (const log of copLogs) {
          if (!logMap.has(log.part_id)) logMap.set(log.part_id, {})
          logMap.get(log.part_id)![`kop${log.slot}`] = coopMap.get(log.cooperation_id) ?? ''
        }

        // form_log real — wymiary, materiał, masa, pow.
        const realMap = new Map<number, Record<string, string>>()
        for (const fl of formLogs) {
          if (fl.dim_a_real == null && fl.dim_b_real == null) continue
          const patch: Record<string, string> = {}
          if (fl.dim_c_real != null) {
            // graniastosłup: A, B, C
            if (fl.dim_a_real != null) patch['a']     = String(fl.dim_a_real)
            if (fl.dim_b_real != null) patch['b']     = String(fl.dim_b_real)
            patch['c_col'] = String(fl.dim_c_real)
          } else {
            // walec: Śr, Dł
            if (fl.dim_a_real != null) patch['sr'] = String(fl.dim_a_real)
            if (fl.dim_b_real != null) patch['dl'] = String(fl.dim_b_real)
          }
          realMap.set(fl.part_id, patch)
        }

        // time_real z operation_logs → komórki operacji
        const opIdToKey = new Map<number, string>()
        for (const op of ops) {
          const key = OP_NAME_TO_KEY[op.name]
          if (key) opIdToKey.set(op.id, key)
        }
        const opTimeMap = new Map<number, Record<string, string>>()
        for (const log of opLogs) {
          if (log.time_real == null) continue
          const key = opIdToKey.get(log.operation_id)
          if (!key) continue
          if (!opTimeMap.has(log.part_id)) opTimeMap.set(log.part_id, {})
          opTimeMap.get(log.part_id)![key] = String(log.time_real)
        }

        // material_est_id → nazwa (materiał szacowany)
        const currentMats = materialsRef.current
        const formMatMap  = new Map(formLogs.map(fl => [fl.part_id, fl.material_est_id]))

        setRows(flat.map((r, i) => {
          const partId  = Number(r._id)
          const matId   = formMatMap.get(partId)
          const matName = matId ? (currentMats.find(m => m.id === matId)?.name ?? '') : ''
          const priceRow    = prices.find(p => p.part_id === partId)
          const handlowka   = priceRow?.cost_commercial_kit != null ? String(priceRow.cost_commercial_kit) : ''
          return {
            ...r,
            lp: String(i + 1),
            ...(logMap.get(partId)    ?? {}),
            ...(realMap.get(partId)   ?? {}),
            ...(opTimeMap.get(partId) ?? {}),
            ...(matName     ? { material:  matName  } : {}),
            ...(handlowka   ? { handlowka             } : {}),
          }
        }))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !containerRef.current) return
    const el  = containerRef.current
    const col = visibleCols[active.c]

    if (col?.stickyIdx === undefined) {
      const cellLeft  = visColLeft[active.c] ?? 0
      const cellRight = cellLeft + (visColWidths[active.c] ?? 0)
      if (cellLeft < el.scrollLeft + STICKY_W)
        el.scrollLeft = cellLeft - STICKY_W
      else if (cellRight > el.scrollLeft + el.clientWidth)
        el.scrollLeft = cellRight - el.clientWidth
    }

    const thead   = el.querySelector('thead') as HTMLElement | null
    const headerH = thead ? thead.offsetHeight : 56
    const ROW_H   = 30
    const rowTop    = headerH + active.r * ROW_H
    const rowBottom = rowTop + ROW_H
    if (rowTop < el.scrollTop + headerH)
      el.scrollTop = rowTop - headerH
    else if (rowBottom > el.scrollTop + el.clientHeight)
      el.scrollTop = rowBottom - el.clientHeight
  }, [active])

  // Focusuj właściwy input filtra
  useEffect(() => {
    if (showFilterRow) setTimeout(() => filterInputRef.current?.focus(), 0)
  }, [showFilterRow, filterCol])

  const toggleSort = (ci: number, e: React.MouseEvent) => {
    if (!SORTABLE_COLS.has(ci)) return
    e.stopPropagation()
    if (sortCol === ci) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(ci); setSortDir('asc') }
  }

  const openFilter = (ci: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setFilterCol(ci)
    setShowFilterRow(v => !v || filterCol !== ci ? true : false)
  }

  // ── Filtrowanie ───────────────────────────────────────────────────────────
  const searchFiltered = rows.filter(r => {
    const q = search.toLowerCase()
    return !q
      || r.numer_zlecenia.toLowerCase().includes(q)
      || r.numer_detalu.toLowerCase().includes(q)
      || r.nazwa_detalu.toLowerCase().includes(q)
  })

  const colFiltered = Object.entries(colFilters).reduce((acc, [ci, val]) => {
    if (!val?.trim()) return acc
    const key = COLS[Number(ci)]?.key
    if (!key) return acc
    const v = val.toLowerCase()
    return acc.filter(r => String(r[key] ?? '').toLowerCase().includes(v))
  }, searchFiltered)

  const visibleRows = sortCol !== null && sortDir !== null
    ? [...colFiltered].sort((a, b) => {
        const key = visibleCols[sortCol]?.key
        if (!key) return 0
        const va = String(a[key] ?? ''), vb = String(b[key] ?? '')
        const na = parseFloat(va), nb = parseFloat(vb)
        const cmp = (!isNaN(na) && !isNaN(nb))
          ? na - nb
          : va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : colFiltered

  const nRows = visibleRows.length
  const nCols = visibleCols.length
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v))

  // ── Mutacje ───────────────────────────────────────────────────────────────
  const updateCell = useCallback((rowId: string, key: string, value: string) =>
    setRows(prev => prev.map(r => r._id === rowId ? { ...r, [key]: value } : r)), [])

  const saveOpTimeReal = useCallback((row: Row, changedKey: string, changedVal: string) => {
    if (!(changedKey in OP_KEY_TO_NAME)) return
    const opName = OP_KEY_TO_NAME[changedKey]
    const op     = operationsRef.current.find(o => o.name === opName)
    if (!op) return
    const timeReal = changedVal !== '' ? parseFloat(changedVal) : null
    operationLogsApi.saveReal(Number(row._id), op.id, timeReal).catch(console.error)
  }, [])

  const DIM_KEYS = new Set(['a', 'b', 'c_col', 'sr', 'dl', 'material'])

  const saveFormLogReal = useCallback((row: Row, changedKey: string, changedVal: string) => {
    if (!DIM_KEYS.has(changedKey)) return
    const merged = { ...row, [changedKey]: changedVal } as unknown as Record<string, string>
    const sr = parseFloat(merged['sr'] || '0')
    const dl = parseFloat(merged['dl'] || '0')
    let dimA: number | null = null, dimB: number | null = null, dimC: number | null = null
    if (sr > 0 && dl > 0) {
      dimA = sr; dimB = dl
    } else {
      const a = parseFloat(merged['a'] || '0')
      const b = parseFloat(merged['b'] || '0')
      const c = parseFloat(merged['c_col'] || '0')
      if (a > 0) dimA = a
      if (b > 0) dimB = b
      if (c > 0) dimC = c
    }
    const asRow = merged as unknown as Row
    const massStr = calcMass(asRow, materialsRef.current)
    const areaStr = calcPowSzt(asRow)
    const mat     = materialsRef.current.find(m => m.name === merged['material'])
    formLogApi.saveReal({
      part_id:    Number(row._id),
      dim_a_real: dimA,
      dim_b_real: dimB,
      dim_c_real: dimC,
      material_id: mat?.id ?? null,
      weight_one: massStr ? parseFloat(massStr) : null,
      area_one:   areaStr ? parseFloat(areaStr) : null,
    }).catch(console.error)
  }, [])

// ── Nawigacja ─────────────────────────────────────────────────────────────
  const moveTo = useCallback((r: number, c: number) => {
    setActive({ r: clamp(r, nRows), c: clamp(c, nCols) })
    setEditing(null)
    containerRef.current?.focus()
  }, [nRows, nCols])

  const startEditing = useCallback((r: number, c: number) => {
    if (COLS[c]?.readOnly) return
    setActive({ r, c }); setEditing({ r, c })
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing || !active) return
    const { r, c } = active
    const row = visibleRows[r]
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); moveTo(r, c + 1); break
      case 'ArrowLeft':  e.preventDefault(); moveTo(r, c - 1); break
      case 'ArrowDown':  e.preventDefault(); moveTo(r + 1, c); break
      case 'ArrowUp':    e.preventDefault(); moveTo(r - 1, c); break
      case 'Tab':        e.preventDefault(); moveTo(r, e.shiftKey ? c - 1 : c + 1); break
      case 'Enter':
      case 'F2':         e.preventDefault(); startEditing(r, c); break
      case 'Delete':
      case 'Backspace':
        if (!visibleCols[c]?.readOnly && row) { e.preventDefault(); updateCell(row._id, visibleCols[c].key, '') }
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) startEditing(r, c)
    }
  }

  // ── Style nagłówków ───────────────────────────────────────────────────────
  const thStyle = (col: ColDef, w: number, isFirstHeaderRow = false, isActive = false): React.CSSProperties => {
    const bg = isActive ? GROUP_BG_ACTIVE[col.group] : GROUP_BG[col.group]
    return {
      background:  bg,
      color:       GROUP_TEXT[col.group],
      fontWeight:  600, fontSize: 12,
      textAlign:   'center',
      padding:     '5px 6px',
      whiteSpace:  'nowrap',
      width: w, minWidth: w, maxWidth: w,
      borderTop:    isFirstHeaderRow ? BORDER : 'none',
      borderLeft:   'none',
      borderRight:  BORDER, borderBottom: BORDER,
      transition:  'background 0.1s',
      ...stickyTdBase(col, bg),
      ...(col.stickyIdx !== undefined ? { zIndex: 3 } : {}),
    }
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#f0f4f8', overflow: 'hidden',
    }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, background: '#fff',
        padding: '8px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'relative',
      }}>
        {/* Placeholder lewy (równy szerokości prawego bloku) */}
        <div style={{ flex: 1 }} />

        {/* Tytuł + licznik — absolutnie wyśrodkowany */}
        <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', fontFamily: 'inherit' }}>Dane poprodukcyjne</span>
        </div>

        {/* Szukaj + logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <button
            onClick={() => { setDraftHidden(new Set(hiddenColKeys)); setShowColPicker(true) }}
            style={{
              border: BORDER, borderRadius: 6, padding: '5px 12px', fontSize: 13,
              background: hiddenColKeys.size > 0 ? '#eff6ff' : '#f8fafc',
              color: hiddenColKeys.size > 0 ? '#2563eb' : '#374151',
              cursor: 'pointer', fontWeight: hiddenColKeys.size > 0 ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            Kolumny {hiddenColKeys.size > 0 ? `(${COLS.length - 5 - hiddenColKeys.size}/${COLS.length - 5})` : ''}
          </button>
        </div>
      </div>

      {/* Loading / error */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
          <span style={{ color: '#6b7280', fontSize: 13 }}>Ładowanie danych…</span>
        </div>
      )}
      {error && <p style={{ textAlign: 'center', color: '#ef4444' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── Tabela ──────────────────────────────────────────────────── */}
          <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, overflow: 'auto', outline: 'none' }}
          >
            <div style={{ width: '100%', background: '#fff', borderLeft: BORDER, borderRight: BORDER, borderTop: BORDER, boxSizing: 'border-box' }}>
            <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <colgroup>
                {visibleCols.map((col, i) => (
                  <col key={col.key} style={{ width: visColWidths[i] }} />
                ))}
              </colgroup>

              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                {/* Wiersz grup */}
                <tr>
                  {visGroups.map(g => (
                    <th key={g.group} colSpan={g.count} style={{
                      background: GROUP_BG[g.group], color: GROUP_TEXT[g.group],
                      fontWeight: 700, fontSize: 12, textAlign: 'center',
                      padding: '4px 8px', whiteSpace: 'nowrap',
                      borderTop: BORDER, borderLeft: 'none',
                      borderRight: BORDER, borderBottom: BORDER,
                      ...(g.group === 'base' ? { position: 'sticky' as const, left: 0, zIndex: 4 } : {}),
                    }}>
                      {g.label}
                    </th>
                  ))}
                </tr>

                {/* Wiersz etykiet */}
                <tr>
                  {visibleCols.map((col, ci) => {
                    const hasFilter  = !!colFilters[ci]?.trim()
                    const isSortable = SORTABLE_COLS.has(ci)
                    return (
                      <th
                        key={col.key}
                        style={{ ...thStyle(col, visColWidths[ci], false, active?.c === ci), cursor: isSortable ? 'pointer' : 'default', paddingRight: 4 }}
                        onClick={e => isSortable && toggleSort(ci, e)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center' }}>
                            {col.label}
                            {isSortable && (
                              <span style={{ fontSize: 10, opacity: sortCol === ci ? 1 : 0.4, color: sortCol === ci ? GROUP_TEXT[col.group] : 'inherit' }}>
                                {sortCol === ci ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            )}
                          </span>
                          {FILTER_COLS.has(ci) && (
                            <span
                              title="Filtruj"
                              onClick={e => openFilter(ci, e)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, padding: '1px 3px', borderRadius: 3,
                                background: hasFilter ? '#2563eb' : 'transparent',
                                color: hasFilter ? '#fff' : '#94a3b8',
                                fontSize: 10, lineHeight: 1, cursor: 'pointer',
                              }}
                            >
                              ▽
                            </span>
                          )}
                        </span>
                      </th>
                    )
                  })}
                </tr>

                {/* Wiersz filtrów inline */}
                {showFilterRow && (
                  <tr>
                    {visibleCols.map((col, ci) => {
                      const isFilterable = FILTER_COLS.has(ci)
                      const cellBg = '#eff6ff'
                      const stickyStyle: React.CSSProperties = col.stickyIdx !== undefined
                        ? { position: 'sticky', left: WS_LEFT[col.stickyIdx], zIndex: 4 }
                        : {}
                      return (
                        <td key={col.key} style={{ background: cellBg, borderRight: BORDER, borderBottom: BORDER, padding: isFilterable ? '2px 4px' : 0, ...stickyStyle }}>
                          {isFilterable && (
                            <input
                              ref={filterCol === ci ? filterInputRef : null}
                              value={colFilters[ci] ?? ''}
                              onChange={e => setColFilters(f => ({ ...f, [ci]: e.target.value }))}
                              onKeyDown={e => {
                                e.stopPropagation()
                                if (e.key === 'Enter')  setShowFilterRow(false)
                                if (e.key === 'Escape') { setColFilters(f => { const n = {...f}; delete n[ci]; return n }); setShowFilterRow(false) }
                              }}
                              onClick={e => e.stopPropagation()}
                              placeholder="Szukaj..."
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                border: '1px solid #93c5fd', borderRadius: 3,
                                padding: '2px 6px', fontSize: 12, outline: 'none',
                                background: '#fff',
                              }}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </thead>

              <tbody>
                {visibleRows.map((row, ri) => {
                  const isRowActive  = active?.r === ri
                  const rowKwotaRbh  = calcKwotaRbh(row, operations)
                  const rowCenaKoop  = calcCenaKoop(row, cooperations, materials)
                  const rowSumaObrob = (() => {
                    if (!rowKwotaRbh) return ''
                    const rbh  = parseFloat(rowKwotaRbh  || '0')
                    const koop = parseFloat(rowCenaKoop   || '0')
                    const sum  = rbh + koop
                    return sum > 0 ? String(Math.round(sum * 100) / 100) : ''
                  })()
                  const rowMaterialSzt = calcMaterialSzt(row, materials)
                  const rowMaterialKpl = (() => {
                    const szt = parseFloat(rowMaterialSzt || '0')
                    const qty = parseIlosc(row['ilosc']   || '0')
                    if (!szt || !qty) return ''
                    return String(Math.round(szt * qty * 100) / 100)
                  })()
                  const rowCenaKpl = (() => {
                    const handlowka = parseFloat(row['handlowka']  || '0')
                    const sumaObrob = parseFloat(rowSumaObrob      || '0')
                    const matKpl    = parseFloat(rowMaterialKpl    || '0')
                    // Pokaż cenę tylko gdy dane operacyjne i materiałowe są uzupełnione
                    if (!sumaObrob || !matKpl) return ''
                    const sum = handlowka + sumaObrob + matKpl
                    return sum > 0 ? String(Math.round(sum * 100) / 100) : ''
                  })()
                  const rowCenaSzt = (() => {
                    const kpl = parseFloat(rowCenaKpl   || '0')
                    const qty = parseIlosc(row['ilosc'] || '0')
                    if (!kpl || !qty) return ''
                    return String(Math.round(kpl / qty * 100) / 100)
                  })()
                  return (
                    <tr key={row._id} style={{ background: isRowActive ? BG_ROW_ACTIVE : '#ffffff' }}>
                      {visibleCols.map((col, ci) => {
                        const isActive  = isRowActive && active?.c === ci
                        const isEditing = editing?.r === ri && editing?.c === ci
                        if (col.key === 'material') {
                          return (
                            <MatCell
                              key={col.key}
                              value={row[col.key] ?? ''}
                              materials={materials}
                              active={isActive}
                              rowActive={isRowActive}
                              onActivate={() => { setActive({ r: ri, c: ci }); setEditing(null) }}
                              onUpdate={v => { updateCell(row._id, col.key, v); saveFormLogReal(row, col.key, v) }}
                            />
                          )
                        }
                        if (col.key === 'kop1' || col.key === 'kop2' || col.key === 'kop3') {
                          return (
                            <KopCell
                              key={col.key}
                              value={row[col.key] ?? ''}
                              cooperations={cooperations}
                              active={isActive}
                              rowActive={isRowActive}
                              onActivate={() => { setActive({ r: ri, c: ci }); setEditing(null) }}
                              onUpdate={name => {
                                updateCell(row._id, col.key, name)
                                const coop = cooperations.find(c => c.name === name)
                                cooperationLogApi.save({
                                  part_id:        Number(row._id),
                                  cooperation_id: coop?.id ?? null,
                                  slot:           KOP_SLOT[col.key],
                                }).catch(console.error)
                              }}
                            />
                          )
                        }
                        return (
                          <Cell
                            key={col.key}
                            col={col}
                            value={(() => {
                              if (col.key === 'total')         return calcTotal(row)
                              if (col.key === 'cena_koop')     return rowCenaKoop
                              if (col.key === 'kwota_rbh')     return rowKwotaRbh
                              if (col.key === 'suma_obrobki')  return rowSumaObrob
                              if (col.key === 'material_szt')  return rowMaterialSzt
                              if (col.key === 'material_kpl')  return rowMaterialKpl
                              if (col.key === 'cena_kpl')      return rowCenaKpl
                              if (col.key === 'cena_szt')      return rowCenaSzt
                              if (col.key === 'masa_szt') return calcMass(row, materials)
                              if (col.key === 'pow_szt')  return calcPowSzt(row)
                              if (col.key === 'masa_kpl' || col.key === 'pow_kpl') {
                                const szt = parseFloat(col.key === 'masa_kpl' ? calcMass(row, materials) : calcPowSzt(row))
                                const qty = parseIlosc(row['ilosc'] || '1')
                                if (!szt || isNaN(szt) || !qty) return ''
                                return String(Math.round(szt * qty * 100) / 100)
                              }
                              return row[col.key] ?? ''
                            })()}
                            active={isActive}
                            rowActive={isRowActive}
                            editing={isEditing}
                            onChange={v => updateCell(row._id, col.key, v)}
                            onActivate={() => { setActive({ r: ri, c: ci }); setEditing(null) }}
                            onStartEdit={() => startEditing(ri, ci)}
                            onCommitAndMove={(dr, dc, v) => {
                              updateCell(row._id, col.key, v)
                              saveFormLogReal(row, col.key, v)
                              saveOpTimeReal(row, col.key, v)
                              setActive({ r: clamp(ri + dr, nRows), c: clamp(ci + dc, nCols) })
                              setEditing(null)
                              containerRef.current?.focus()
                            }}
                            onCancelEdit={() => { setEditing(null); containerRef.current?.focus() }}
                            onNavigate={col.key === 'numer_detalu' && row.numer_detalu
                              ? () => navigate(`/karta-detalu/${encodeURIComponent(row.numer_detalu)}`)
                              : undefined}
                          />
                        )
                      })}
                    </tr>
                  )
                })}

              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
      {/* ── Menu sortowania ──────────────────────────────────────────────── */}
      {/* ── Panel wyboru kolumn ──────────────────────────────────────────────── */}
      {showColPicker && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setShowColPicker(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 10, width: 320,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              display: 'flex', flexDirection: 'column', maxHeight: '80vh',
            }}
          >
            {/* Nagłówek */}
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Widoczne kolumny</span>
            </div>

            {/* Lista */}
            <div style={{ overflowY: 'auto', padding: '8px 0', flex: 1 }}>
              {(['operacje', 'wymiary', 'koszty'] as Group[]).map(g => {
                const groupCols = COLS.filter(c => c.group === g)
                if (!groupCols.length) return null
                const groupLabel = g === 'operacje' ? 'Operacje' : g === 'wymiary' ? 'Wymiary / Materiały' : 'Koszty'
                return (
                  <div key={g}>
                    <div style={{ padding: '5px 18px 5px', fontSize: 11, fontWeight: 700, color: GROUP_TEXT[g], background: GROUP_BG[g], letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={groupCols.every(c => !draftHidden.has(c.key))}
                        ref={el => {
                          if (el) {
                            const allVisible = groupCols.every(c => !draftHidden.has(c.key))
                            const someHidden  = groupCols.some(c => draftHidden.has(c.key))
                            el.indeterminate = someHidden && !allVisible
                          }
                        }}
                        onChange={() => {
                          const allVisible = groupCols.every(c => !draftHidden.has(c.key))
                          setDraftHidden(prev => {
                            const next = new Set(prev)
                            if (allVisible) {
                              groupCols.forEach(c => next.add(c.key))
                            } else {
                              groupCols.forEach(c => next.delete(c.key))
                            }
                            return next
                          })
                        }}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: GROUP_TEXT[g], flexShrink: 0 }}
                      />
                      {groupLabel}
                    </div>
                    {groupCols.map(col => {
                      const hidden = draftHidden.has(col.key)
                      return (
                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 18px', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <input
                            type="checkbox"
                            checked={!hidden}
                            onChange={() => setDraftHidden(prev => {
                              const next = new Set(prev)
                              hidden ? next.delete(col.key) : next.add(col.key)
                              return next
                            })}
                            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#2563eb' }}
                          />
                          <span style={{ fontSize: 13, color: '#1e293b' }}>{col.label}</span>
                        </label>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Przyciski */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setDraftHidden(new Set()); setHiddenColKeys(new Set()); setShowColPicker(false) }}
                style={{ padding: '5px 14px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', color: '#64748b' }}
              >
                Pokaż wszystkie
              </button>
              <button
                onClick={() => setShowColPicker(false)}
                style={{ padding: '5px 14px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', color: '#374151' }}
              >
                Anuluj
              </button>
              <button
                onClick={() => { setHiddenColKeys(new Set(draftHidden)); setShowColPicker(false); setActive(null) }}
                style={{ padding: '5px 14px', fontSize: 13, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}


      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
