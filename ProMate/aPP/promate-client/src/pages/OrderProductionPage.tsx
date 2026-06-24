import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ordersApi, operationLogsApi, OperationLog, formLogApi, FormLogDims, cooperationsApi, Cooperation, cooperationLogApi, CooperationLog, commercialApi, partsApi, PartSearchResult, PartPaths, materialsApi, Material, dialogApi } from '../services/api'
import { Part } from '../types'
import { loadSettings } from './SettingsPage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrzerobkaPart {
  numer_detalu:   string
  numer_projektu: string
}

interface Row {
  id:              number
  numer_zlecenia:  string
  termin_wyk:      string
  numer_detalu:    string
  nazwa_detalu:    string
  ilosc:           string
  ploter:     string;  ploter_seq:    string
  fkg:        string;  fkg_seq:       string
  fko:        string;  fko_seq:       string
  tok:        string;  tok_seq:       string
  tokcnc:     string;  tokcnc_seq:    string
  fcnc:       string;  fcnc_seq:      string
  fcnc_robo:  string;  fcnc_robo_seq: string
  col_a:           string
  col_b:           string
  col_c:           string
  kop1:            string
  kop2:            string
  kop3:            string
  suma_czasu:      string
  material:        string
  handlowka:             boolean
  phase_id:              number | null
  przerobka:             boolean   // = !!rework_parent_part_id
  rework_parent_part_id: number | null
  oryginalny_detal:      string
  przerobka_parts:       PrzerobkaPart[]
}

// ─── Grupy kolumn ─────────────────────────────────────────────────────────────

type Group = 'podstawowe' | 'operacje' | 'dodatkowe' | 'kooperacje' | 'inne'

const GROUP_BG: Record<Group, string>        = { podstawowe: '#dbeafe', operacje: '#ffedd5', dodatkowe: '#ccfbf1', kooperacje: '#f3e8ff', inne: '#dcfce7' }
const GROUP_BG_ACTIVE: Record<Group, string> = { podstawowe: '#93c5fd', operacje: '#fdba74', dodatkowe: '#5eead4', kooperacje: '#d8b4fe', inne: '#86efac' }
const GROUP_TEXT: Record<Group, string>      = { podstawowe: '#1e40af', operacje: '#9a3412', dodatkowe: '#0f766e', kooperacje: '#6b21a8', inne: '#166534' }
// ─── Definicje kolumn ─────────────────────────────────────────────────────────

interface ColDef {
  key:        string
  label:      string
  group:      Group
  readOnly?:  boolean
  checkbox?:  boolean
  stickyIdx?: number
  width:      number
}

const COLS: ColDef[] = [
  { key: 'lp',             label: 'Lp.',           group: 'podstawowe', readOnly: true, stickyIdx: 0, width: 34  },
  { key: 'numer_zlecenia', label: 'Numer Zlecenia', group: 'podstawowe', readOnly: true, stickyIdx: 1, width: 132 },
  { key: 'termin_wyk',     label: 'Termin Wyk.',    group: 'podstawowe', readOnly: true, stickyIdx: 2, width: 78  },
  { key: 'numer_detalu',   label: 'Numer Detalu',   group: 'podstawowe',                stickyIdx: 3, width: 127 },
  { key: 'nazwa_detalu',   label: 'Nazwa Detalu',   group: 'podstawowe',                stickyIdx: 4, width: 148 },
  { key: 'ilosc',          label: 'Ilość',          group: 'podstawowe',                stickyIdx: 5, width: 38  },
  { key: 'ploter',    label: 'Ploter',    group: 'operacje', width: 70 },
  { key: 'fkg',       label: 'FKG',       group: 'operacje', width: 70 },
  { key: 'fko',       label: 'FKO',       group: 'operacje', width: 70 },
  { key: 'tok',       label: 'TOK',       group: 'operacje', width: 70 },
  { key: 'tokcnc',    label: 'TOKCNC',    group: 'operacje', width: 70 },
  { key: 'fcnc',      label: 'FCNC',      group: 'operacje', width: 70 },
  { key: 'fcnc_robo', label: 'FCNC ROBO', group: 'operacje', width: 70 },
  { key: 'suma_czasu', label: 'Suma czasu', group: 'inne', readOnly: true, width: 72 },
  { key: 'col_a',     label: 'A',          group: 'dodatkowe',  width: 40 },
  { key: 'col_b',     label: 'B',          group: 'dodatkowe',  width: 40 },
  { key: 'col_c',     label: 'C',          group: 'dodatkowe',  width: 40 },
  { key: 'material',   label: 'Materiał',   group: 'dodatkowe', width: 110 },
  { key: 'kop1',      label: 'Kop. 1',    group: 'kooperacje', width: 95 },
  { key: 'kop2',      label: 'Kop. 2',    group: 'kooperacje', width: 95 },
  { key: 'kop3',      label: 'Kop. 3',    group: 'kooperacje', width: 95 },
  { key: 'handlowka',  label: 'Handl.',     group: 'inne', checkbox: true, width: 62 },
  { key: 'przerobka',  label: 'Przer.',      group: 'inne', width: 62 },
]

// ─── Kolumny z sortowaniem / filtrowaniem ─────────────────────────────────────

const SORTABLE_COLS   = new Set(['numer_zlecenia','termin_wyk','numer_detalu','nazwa_detalu','ilosc',
  'ploter','fkg','fko','tok','tokcnc','fcnc','fcnc_robo','suma_czasu','col_a','col_b','col_c','material'])
const FILTERABLE_COLS = new Set(['numer_zlecenia','termin_wyk','numer_detalu','nazwa_detalu','ilosc','material'])
const NUMERIC_SORT    = new Set(['ilosc','ploter','fkg','fko','tok','tokcnc','fcnc','fcnc_robo','col_a','col_b','col_c'])

// ─── Layout constants ─────────────────────────────────────────────────────────

const _WS     = COLS.filter(c => c.stickyIdx !== undefined).map(c => c.width)
const WS_LEFT = _WS.reduce<number[]>((acc, _, i) =>
  [...acc, i === 0 ? 0 : acc[i - 1] + _WS[i - 1]], [])
const STICKY_W = _WS.reduce((s, w) => s + w, 0)

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG_PAGE        = '#f0f4f8'
const BORDER         = '1px solid #d1d5db'
const BG_CELL_ACTIVE = '#dbeafe'
const BG_ROW_ACTIVE  = '#f0f9ff'
const ACTIVE_RING    = '#2563eb'
const BTN_BG         = '#0ea5e9'
const ROW_H          = 32

// ─── Mapowanie kolumna → operation_id (zgodnie z tabelą operation w bazie) ────

const OPERATION_MAP: Record<string, number> = {
  ploter:    1,
  fkg:       2,
  fko:       3,
  tok:       4,
  tokcnc:    5,
  fcnc:      6,
  fcnc_robo: 7,
}

// ─── OP columns whose sums go into totals row ─────────────────────────────────

const TOTALS_COLS = new Set(['ploter', 'fkg', 'fko', 'tok', 'tokcnc', 'fcnc', 'fcnc_robo'])
const SUM_KEYS    = ['ploter','fkg','fko','tok','tokcnc','fcnc','fcnc_robo'] as const
const KOP_SLOT: Record<string, number> = { kop1: 1, kop2: 2, kop3: 3 }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sumRow(row: Row): number {
  return SUM_KEYS.reduce(
    (s, k) => s + (parseFloat((row as unknown as Record<string, string>)[k]) || 0), 0
  )
}

function getCellValue(col: ColDef, row: Row, lp: number): string {
  if (col.key === 'lp') return String(lp)
  if (col.key === 'suma_czasu') { const s = sumRow(row); return s ? String(s) : '' }
  return String((row as unknown as Record<string, unknown>)[col.key] ?? '')
}

function totalColValue(col: ColDef, rows: Row[]): string {
  if (!TOTALS_COLS.has(col.key)) return ''
  const t = rows.reduce(
    (s, r) => s + (parseFloat((r as unknown as Record<string, string>)[col.key]) || 0), 0
  )
  return t ? String(t) : ''
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// done: true = ✓ zielony | false = ✗ czerwony | null = ⟳ ładowanie | 'na' = — szary
function CheckItem({ label, done, note }: { label: string; done: boolean | 'na' | null; note?: string }) {
  const loading = done === null
  const icon    = loading ? '⟳' : done === true ? '✓' : done === 'na' ? '–' : '✗'
  const bg      = loading ? '#cbd5e1' : done === true ? '#22c55e' : done === 'na' ? '#94a3b8' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 11, fontWeight: 800,
        animation: loading ? 'spin 0.9s linear infinite' : 'none',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</div>
        {note && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{note}</div>}
      </div>
    </div>
  )
}

function stickyBase(col: ColDef, bg: string): React.CSSProperties {
  if (col.stickyIdx === undefined) return {}
  return { position: 'sticky', left: WS_LEFT[col.stickyIdx], zIndex: 2, background: bg }
}

function calcIlosc(p: Part): string {
  if (p.quantity_right === 0) return String(p.quantity_left)
  if (p.quantity_left  === 0) return String(p.quantity_right)
  return `${p.quantity_right}+${p.quantity_left}`
}

function partToRow(p: Part, orderNumber: string, termin: string): Row {
  return {
    id: p.id, numer_zlecenia: orderNumber, termin_wyk: termin,
    numer_detalu: p.part_number, nazwa_detalu: p.name, ilosc: calcIlosc(p),
    ploter: '', ploter_seq: '', fkg: '', fkg_seq: '', fko: '', fko_seq: '',
    tok: '', tok_seq: '', tokcnc: '', tokcnc_seq: '', fcnc: '', fcnc_seq: '', fcnc_robo: '', fcnc_robo_seq: '',
    col_a: '', col_b: '', col_c: '',
    kop1: '', kop2: '', kop3: '', suma_czasu: '', material: '',
    phase_id: p.phase_id ?? null,
    handlowka: false, przerobka: !!p.rework_parent_part_id,
    rework_parent_part_id: p.rework_parent_part_id ?? null,
    oryginalny_detal: '', przerobka_parts: [],
  }
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

interface CellProps {
  col:             ColDef
  value:           string
  active:          boolean
  rowActive:       boolean
  editing:         boolean
  onActivate:      () => void
  onStartEdit:     () => void
  onCommitAndMove: (dr: number, dc: number, val: string, autoEdit?: boolean) => void
  onCancelEdit:    () => void
}

function Cell({ col, value, active, rowActive, editing, onActivate, onStartEdit, onCommitAndMove, onCancelEdit }: CellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef  = useRef(false)

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
  }, [editing])

  const bg = active ? BG_CELL_ACTIVE : rowActive ? BG_ROW_ACTIVE : '#fff'

  const tdStyle: React.CSSProperties = {
    ...stickyBase(col, bg),
    height: ROW_H, padding: 0,
    borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
    whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box',
    outline: active ? `2px solid ${ACTIVE_RING}` : 'none',
    outlineOffset: -2, background: bg,
  }

  if (col.readOnly) {
    return (
      <td style={tdStyle} onClick={onActivate}>
        <div style={{ padding: '0 6px', height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: (col.key === 'lp' || col.key === 'suma_czasu') ? 'center' : 'flex-start', fontSize: 13, color: '#374151' }}>
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
          style={{ width: '100%', height: ROW_H - 2, padding: '0 6px', border: 'none', outline: 'none', fontSize: 12, background: BG_CELL_ACTIVE, boxSizing: 'border-box', color: '#0f172a' }}
          onKeyDown={e => {
            doneRef.current = false
            const v = e.currentTarget.value
            if (e.key === 'Enter')      { e.preventDefault(); doneRef.current = true; onCommitAndMove(0, 1, v, true) }
            else if (e.key === 'Tab')        { e.preventDefault(); doneRef.current = true; onCommitAndMove(0, e.shiftKey ? -1 : 1, v, true) }
            else if (e.key === 'Escape')     { e.preventDefault(); doneRef.current = true; onCancelEdit() }
            else if (e.key === 'ArrowDown')  { e.preventDefault(); doneRef.current = true; onCommitAndMove(1, 0, v, true) }
            else if (e.key === 'ArrowUp')    { e.preventDefault(); doneRef.current = true; onCommitAndMove(-1, 0, v, true) }
            else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === v.length) { e.preventDefault(); doneRef.current = true; onCommitAndMove(0, 1, v, true) }
            else if (e.key === 'ArrowLeft'  && e.currentTarget.selectionStart === 0)        { e.preventDefault(); doneRef.current = true; onCommitAndMove(0, -1, v, true) }
          }}
          onBlur={e => { if (doneRef.current) return; onCommitAndMove(0, 0, e.currentTarget.value) }}
        />
      </td>
    )
  }

  return (
    <td style={tdStyle} onClick={onActivate} onDoubleClick={onStartEdit}>
      <div style={{ padding: '0 6px', height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: (col.key === 'nazwa_detalu' || col.key === 'numer_detalu') ? 'flex-start' : 'center', fontSize: 13, color: '#0f172a' }}>
        {value}
      </div>
    </td>
  )
}

// ─── OpCell ───────────────────────────────────────────────────────────────────

const OP_SEQ_OPTIONS = ['1', '2', '3', '4', '5', '6', '7']

interface OpCellProps {
  timeVal:         string
  seqVal:          string
  usedSeqs:        Set<string>
  active:          boolean
  rowActive:       boolean
  editing:         boolean
  onActivate:      () => void
  onAfterSelect:   () => void   // focus kontenera bez auto-assign
  onStartEdit:     () => void
  onUpdateTime:    (v: string) => void
  onUpdateSeq:     (v: string) => void
  onCommitAndMove: (dr: number, dc: number, val: string, autoEdit?: boolean) => void
  onCancelEdit:    () => void
}

function OpCell({ timeVal, seqVal, usedSeqs, active, rowActive, editing, onActivate, onAfterSelect, onStartEdit, onUpdateTime, onUpdateSeq, onCommitAndMove, onCancelEdit }: OpCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef  = useRef(false)

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
  }, [editing])

  const missingSeq = !!timeVal && !seqVal
  const bg = active ? BG_CELL_ACTIVE : rowActive ? BG_ROW_ACTIVE : missingSeq ? '#fee2e2' : '#fff'

  const tdStyle: React.CSSProperties = {
    height: ROW_H, padding: 0,
    borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
    whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box',
    outline: active ? `2px solid ${ACTIVE_RING}` : missingSeq ? '2px solid #fca5a5' : 'none',
    outlineOffset: -2, background: bg,
  }

  return (
    <td style={tdStyle} onClick={onActivate} onDoubleClick={onStartEdit}>
      <div style={{ display: 'flex', height: '100%', alignItems: 'stretch' }}>

        {/* ── Select kolejności (1-7) ── */}
        <select
          value={seqVal}
          onChange={e => {
            e.stopPropagation()
            onUpdateSeq(e.target.value)
            onAfterSelect()   // po wyborze: setActive + focus kontenera (bez auto-assign)
          }}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault(); e.stopPropagation()
              onUpdateSeq('')
              onAfterSelect()  // po wyczyszczeniu: setActive + focus kontenera
            }
          }}
          title="Kolejność operacji"
          style={{
            width: 26, flexShrink: 0, border: 'none',
            borderRight: '1px solid #e5e7eb',
            fontSize: 11, textAlign: 'center',
            background: seqVal ? '#fef9c3' : bg,
            color: seqVal ? '#713f12' : '#94a3b8',
            outline: 'none', cursor: 'pointer',
            padding: 0, appearance: 'none',
          }}
        >
          <option value="">·</option>
          {OP_SEQ_OPTIONS.map(n => (
            <option
              key={n} value={n}
              disabled={usedSeqs.has(n)}
              style={{
                background: n === seqVal ? '#fef08a' : usedSeqs.has(n) ? '#f3f4f6' : '#fff',
                color:      n === seqVal ? '#713f12' : usedSeqs.has(n) ? '#d1d5db' : '#0f172a',
                fontWeight: n === seqVal ? 700 : 400,
              }}
            >
              {n}
            </option>
          ))}
        </select>

        {/* ── Czas (edytowalny input) ── */}
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={timeVal}
            style={{
              flex: 1, height: '100%', padding: '0 4px',
              border: 'none', outline: 'none',
              fontSize: 12, background: BG_CELL_ACTIVE,
              boxSizing: 'border-box', color: '#0f172a',
              textAlign: 'center',
            }}
            onKeyDown={e => {
              doneRef.current = false
              const v = e.currentTarget.value
              if (e.key === 'Enter')      { e.preventDefault(); doneRef.current = true; onUpdateTime(v); onCommitAndMove(0, 1, v, true) }
              else if (e.key === 'Tab')   { e.preventDefault(); doneRef.current = true; onUpdateTime(v); onCommitAndMove(0, e.shiftKey ? -1 : 1, v, true) }
              else if (e.key === 'Escape'){ e.preventDefault(); doneRef.current = true; onCancelEdit() }
              else if (e.key === 'ArrowDown') { e.preventDefault(); doneRef.current = true; onUpdateTime(v); onCommitAndMove(1, 0, v, true) }
              else if (e.key === 'ArrowUp')   { e.preventDefault(); doneRef.current = true; onUpdateTime(v); onCommitAndMove(-1, 0, v, true) }
              else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === v.length) { e.preventDefault(); doneRef.current = true; onUpdateTime(v); onCommitAndMove(0, 1, v, true) }
              else if (e.key === 'ArrowLeft'  && e.currentTarget.selectionStart === 0)        { e.preventDefault(); doneRef.current = true; onUpdateTime(v); onCommitAndMove(0, -1, v, true) }
            }}
            onBlur={e => { if (doneRef.current) return; onUpdateTime(e.currentTarget.value); onCommitAndMove(0, 0, e.currentTarget.value) }}
          />
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: timeVal ? '#0f172a' : '#d1d5db', padding: '0 2px',
          }}>
            {timeVal || ''}
          </div>
        )}
      </div>
    </td>
  )
}

// ─── KopCell ──────────────────────────────────────────────────────────────────

interface KopCellProps {
  coopId:        string
  cooperations:  Cooperation[]
  invalid:       boolean
  invalidName:   string
  slot:          number
  active:        boolean
  rowActive:     boolean
  onActivate:    () => void
  onAfterSelect: () => void
  onUpdate:      (id: string) => void
}

function KopCell({ coopId, cooperations, invalid, invalidName, active, rowActive, onActivate, onAfterSelect, onUpdate }: KopCellProps) {
  const KOP_ACTIVE = '#ede9fe'
  const KOP_ROW    = '#faf5ff'
  const KOP_RING   = '#7c3aed'

  const bg = active ? KOP_ACTIVE : rowActive ? KOP_ROW : '#fff'

  const tdStyle: React.CSSProperties = {
    height: ROW_H, padding: 0,
    borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
    whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box',
    outline: active ? `2px solid ${KOP_RING}` : invalid ? '2px solid #f97316' : 'none',
    outlineOffset: -2, background: bg,
  }

  return (
    <td style={tdStyle} onClick={onActivate}>
      <select
        value={coopId}
        onChange={e => {
          e.stopPropagation()
          onUpdate(e.target.value)
          onAfterSelect()
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); e.stopPropagation()
            onUpdate('')
            onAfterSelect()
          }
        }}
        style={{
          width: '100%', height: ROW_H - 1,
          border: 'none', outline: 'none',
          fontSize: 12,
          background: invalid ? '#fff7ed' : coopId ? '#f5f3ff' : bg,
          color: invalid ? '#c2410c' : coopId ? '#5b21b6' : '#9ca3af',
          fontWeight: coopId ? 600 : 400,
          padding: '0 6px',
          cursor: 'pointer',
        }}
      >
        <option value="">—</option>
        {invalid && (
          <option value={coopId} style={{ color: '#c2410c', fontStyle: 'italic' }}>
            {invalidName}
          </option>
        )}
        {cooperations.map(c => (
          <option
            key={c.id} value={String(c.id)}
            style={{
              background: String(c.id) === coopId ? '#ede9fe' : '#fff',
              color:      String(c.id) === coopId ? '#5b21b6' : '#0f172a',
              fontWeight: String(c.id) === coopId ? 700 : 400,
            }}
          >
            {c.name}
          </option>
        ))}
      </select>
    </td>
  )
}

// ─── CheckboxCell ─────────────────────────────────────────────────────────────

interface CheckboxCellProps {
  col:       ColDef
  checked:   boolean
  active:    boolean
  rowActive: boolean
  onToggle:  () => void
}


function CheckboxCell({ col, checked, active, rowActive, onToggle }: CheckboxCellProps) {
  const bg = active ? BG_CELL_ACTIVE : rowActive ? BG_ROW_ACTIVE : '#fff'
  return (
    <td style={{
      ...stickyBase(col, bg),
      height: ROW_H, padding: 0,
      borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
      background: bg, cursor: 'pointer',
      outline: active ? `2px solid ${ACTIVE_RING}` : 'none',
      outlineOffset: -2, boxSizing: 'border-box', transition: 'outline 0.05s',
    }} onClick={onToggle}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: ROW_H }}>
        <div style={{
          width: 16, height: 16,
          border: `1.5px solid ${checked ? BTN_BG : '#d1d5db'}`,
          borderRadius: 3, background: checked ? BTN_BG : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.1s',
        }}>
          {checked && <span style={{ color: 'white', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
        </div>
      </div>
    </td>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OrderProductionPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>()
  const navigate        = useNavigate()
  const decoded         = decodeURIComponent(orderNumber ?? '')

  const [rows,         setRows]         = useState<Row[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [active,       setActive]       = useState<{ r: number; c: number } | null>(null)
  const [editing,      setEditing]      = useState<{ r: number; c: number } | null>(null)
  const [cooperations, setCooperations] = useState<Cooperation[]>([])
  const [materials,    setMaterials]    = useState<Material[]>([])
  const [orderId,      setOrderId]      = useState<number | null>(null)
  const [partPaths,    setPartPaths]    = useState<Map<number, PartPaths>>(new Map())
  const [newRow,       setNewRow]       = useState({ numer_detalu: '', nazwa_detalu: '', ilosc: '1', termin_wyk: '' })
  const [newRowSaving, setNewRowSaving] = useState(false)
  const [sortCol,       setSortCol]       = useState<string | null>(null)
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc' | null>(null)
  const [colFilters,    setColFilters]    = useState<Record<string, string>>({})
  const [filterCol,     setFilterCol]     = useState<string | null>(null)
  const [showFilterRow, setShowFilterRow] = useState(false)
  const filterInputRef = useRef<HTMLInputElement>(null)

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(colFilters).filter(([, v]) => v.trim())
    let result: Row[] = activeFilters.length
      ? rows.filter(row => {
          const rec = row as unknown as Record<string, unknown>
          return activeFilters.every(([key, val]) =>
            String(rec[key] ?? '').toLowerCase().includes(val.toLowerCase())
          )
        })
      : rows
    if (sortCol && sortDir) {
      result = [...result].sort((a, b) => {
        const ra = a as unknown as Record<string, string>
        const rb = b as unknown as Record<string, string>
        if (sortCol === 'suma_czasu') {
          const cmp = sumRow(a) - sumRow(b)
          return sortDir === 'asc' ? cmp : -cmp
        }
        const va = ra[sortCol] ?? ''; const vb = rb[sortCol] ?? ''
        const cmp = NUMERIC_SORT.has(sortCol)
          ? (parseFloat(va) || 0) - (parseFloat(vb) || 0)
          : va.localeCompare(vb, 'pl', { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }, [rows, colFilters, sortCol, sortDir])

  // Wybrany folder
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [loadingFiles,   setLoadingFiles]   = useState(false)
  const [fileMsg,        setFileMsg]        = useState<{ text: string; ok: boolean } | null>(null)

  // Modal "Gotowe do produkcji"
  const [readyModal, setReadyModal] = useState<{
    running:      boolean
    pdfOk:        boolean | null
    printEnabled: boolean
    printOk:      boolean | null
    errors:       string[]
  } | null>(null)

  // Przeróbka modal
  const [przerobkaIdx,    setPrzerobkaIdx]    = useState<number | null>(null)
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null)
  const [searchResults,    setSearchResults]    = useState<PartSearchResult[]>([])

  const containerRef = useRef<HTMLDivElement>(null)

  const toggleSort = (key: string, e: React.MouseEvent) => {
    if (!SORTABLE_COLS.has(key)) return
    e.stopPropagation()
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  const openFilter = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFilterCol(key)
    setShowFilterRow(v => !v || filterCol !== key)
  }

  useEffect(() => {
    if (showFilterRow) setTimeout(() => filterInputRef.current?.focus(), 0)
  }, [showFilterRow, filterCol])

  /** Synchronizuje etap detalu: ≥1 czas operacji i ≥2 wymiary → D3, inaczej → D2 */
  const syncPhase = useCallback((partId: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== partId) return r
      const rec      = r as unknown as Record<string, string>
      const OPS      = ['ploter','fkg','fko','tok','tokcnc','fcnc','fcnc_robo']
      const DIMS     = ['col_a','col_b','col_c']
      const hasTime  = OPS.some(k => !!rec[k])
      const dimCount = DIMS.filter(k => !!rec[k]).length
      const d3ok     = hasTime && dimCount >= 2
      if (d3ok  && (r.phase_id === null || r.phase_id < 11)) return { ...r, phase_id: 11 }
      if (!d3ok && r.phase_id !== null && r.phase_id >= 11)  return { ...r, phase_id: 10 }
      return r
    }))
  }, [])

  // ── Skalowanie kolumn (jak w OrderDetailPage) ─────────────────────────────
  const [contW, setContW] = useState(0)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContW(el.clientWidth)
    const obs = new ResizeObserver(([e]) => setContW(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading])

  const visNonSticky  = COLS.filter(c => c.stickyIdx === undefined)
  const nonStickyNat  = visNonSticky.reduce((s, c) => s + c.width, 0)
  // Odejmujemy 2px (lewy+prawy border wewnętrznego diva) żeby uniknąć przepełnienia
  const innerW        = contW > 2 ? contW - 2 : contW
  const availForNonSt = innerW > STICKY_W ? Math.max(innerW - STICKY_W, nonStickyNat) : nonStickyNat
  // Math.floor + reszta do ostatniej kolumny — bez zaokrąglania w górę
  const colWidthsRaw  = COLS.map(col =>
    col.stickyIdx !== undefined
      ? col.width
      : nonStickyNat > 0 ? Math.floor(col.width * availForNonSt / nonStickyNat) : col.width
  )
  const nonStickySum  = colWidthsRaw.reduce((s, w, i) => COLS[i].stickyIdx === undefined ? s + w : s, 0)
  const remainder     = availForNonSt - nonStickySum
  const lastNonStickyIdx = COLS.map((c, i) => c.stickyIdx === undefined ? i : -1).filter(i => i >= 0).at(-1) ?? 0
  const colWidths     = colWidthsRaw.map((w, i) => i === lastNonStickyIdx ? w + remainder : w)
  const colLeft = colWidths.reduce<number[]>((acc, _w, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + colWidths[i - 1])
    return acc
  }, [])

  // ── Załaduj kooperacje i materiały (raz) ─────────────────────────────────
  useEffect(() => {
    cooperationsApi.getAll().then(setCooperations).catch(console.error)
    materialsApi.getAll().then(setMaterials).catch(console.error)
  }, [])

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderNumber) return
    setLoading(true)
    const REVERSE_MAP: Record<number, string> = Object.fromEntries(
      Object.entries(OPERATION_MAP).map(([k, v]) => [v, k])
    )
    Promise.all([ordersApi.searchByNumber(decoded), ordersApi.getAll()])
      .then(([summary, orders]) => {
        const order = orders.find(o => o.order_number === decoded)
        if (!order) throw new Error('Nie znaleziono zamówienia')
        setOrderId(order.id)
        return ordersApi.getParts(order.id).then(async parts => {
          const baseRows = parts.map(p => partToRow(p, decoded, formatDate(summary.deadline_at)))
          // Załaduj istniejące wpisy — każde wywołanie niezależnie (błąd jednego nie blokuje pozostałych)
          const partIds = parts.map(p => p.id)
          const rec = baseRows as unknown as Record<string, unknown>[]

          const logs = await operationLogsApi.getByPartIds(partIds).catch(e => { console.error('operation-logs load error:', e); return [] as OperationLog[] })
          logs.forEach(log => {
            const ri = baseRows.findIndex(r => r.id === log.part_id)
            if (ri === -1) return
            const colKey = REVERSE_MAP[log.operation_id]
            if (!colKey) return
            if (log.time_estimated  != null) rec[ri][colKey]          = String(log.time_estimated)
            if (log.operation_order != null) rec[ri][colKey + '_seq'] = String(log.operation_order)
          })

          const dimLogs = await formLogApi.getByPartIds(partIds).catch(e => { console.error('form-log load error:', e); return [] as FormLogDims[] })
          dimLogs.forEach(dl => {
            const ri = baseRows.findIndex(r => r.id === dl.part_id)
            if (ri === -1) return
            if (dl.dim_a_est != null) rec[ri]['col_a'] = String(dl.dim_a_est)
            if (dl.dim_b_est != null) rec[ri]['col_b'] = String(dl.dim_b_est)
            if (dl.dim_c_est != null) rec[ri]['col_c'] = String(dl.dim_c_est)
            if (dl.material_est_id != null) rec[ri]['material'] = String(dl.material_est_id)
          })

          const coopLogs = await cooperationLogApi.getByPartIds(partIds).catch(e => { console.error('cooperation-log load error:', e); return [] as CooperationLog[] })
          coopLogs.forEach(cl => {
            const ri = baseRows.findIndex(r => r.id === cl.part_id)
            if (ri === -1) return
            rec[ri][`kop${cl.slot}`] = String(cl.cooperation_id)
          })

          const commercialPartIds = await commercialApi.getCheckedPartIds(partIds).catch(e => { console.error('commercial load error:', e); return [] as number[] })
          commercialPartIds.forEach(partId => {
            const ri = baseRows.findIndex(r => r.id === partId)
            if (ri !== -1) rec[ri]['handlowka'] = true
          })

          setRows(baseRows)

          partsApi.getPaths(partIds).then(paths => {
            setPartPaths(new Map(paths.map(p => [p.part_id, p])))
            const firstFile = paths.flatMap(p => [p.PDF_path, p.DWG_path, p.STP_path]).find(Boolean)
            if (firstFile) {
              const dir = firstFile.replace(/[/\\][^/\\]+$/, '')
              setSelectedFolder(dir)
            }
          }).catch(console.error)
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [orderNumber])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !containerRef.current) return
    const el  = containerRef.current
    const col = COLS[active.c]
    if (col.stickyIdx === undefined) {
      const l = colLeft[active.c], r = l + colWidths[active.c]
      if (l < el.scrollLeft + STICKY_W) el.scrollLeft = l - STICKY_W
      else if (r > el.scrollLeft + el.clientWidth) el.scrollLeft = r - el.clientWidth
    }
    const thead = el.querySelector('thead') as HTMLElement | null
    const hh    = thead ? thead.offsetHeight : 56
    const top   = hh + active.r * ROW_H
    const bot   = top + ROW_H
    if (top < el.scrollTop + hh) el.scrollTop = top - hh
    else if (bot > el.scrollTop + el.clientHeight) el.scrollTop = bot - el.clientHeight
  }, [active])

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateCell = useCallback((rowId: number, key: string, val: string) =>
    setRows(prev => prev.map(row => row.id === rowId ? { ...row, [key]: val } : row)), [])

  const toggleCheckbox = useCallback((ri: number, key: 'handlowka') => {
    const rowId  = filteredRows[ri].id
    const wasOff = !filteredRows[ri][key]
    setRows(prev => prev.map(row => row.id === rowId ? { ...row, [key]: !row[key] } : row))
    setActive({ r: ri, c: COLS.findIndex(c => c.key === key) })
    if (wasOff) commercialApi.create(rowId).catch(console.error)
    else        commercialApi.delete(rowId).catch(console.error)
  }, [filteredRows])

  const openPrzerobkaModal = useCallback((ri: number) => {
    const fRow = filteredRows[ri]
    setSelectedParentId(fRow.rework_parent_part_id)
    setSearchResults([])
    setRows(prev => prev.map(r => r.id === fRow.id ? { ...r, oryginalny_detal: r.numer_detalu } : r))
    setActive({ r: ri, c: COLS.findIndex(c => c.key === 'przerobka') })
    setPrzerobkaIdx(ri)
  }, [filteredRows])

  // ── Navigation ────────────────────────────────────────────────────────────
  const moveTo = useCallback((r: number, c: number) => {
    setActive({ r: Math.max(0, Math.min(filteredRows.length - 1, r)), c: Math.max(0, Math.min(COLS.length - 1, c)) })
    setEditing(null)
  }, [filteredRows.length])

  const startEditing = useCallback((r: number, c: number) => {
    if (COLS[c].readOnly || COLS[c].checkbox) return
    setActive({ r, c }); setEditing({ r, c })
  }, [])

  const commitAndMove = useCallback((rowId: number, ci: number, dr: number, dc: number, val: string, autoEdit = false) => {
    updateCell(rowId, COLS[ci].key, val); setEditing(null)
    if (dr !== 0 || dc !== 0) {
      const curR = filteredRows.findIndex(r => r.id === rowId)
      const newR = Math.max(0, Math.min(filteredRows.length - 1, curR + dr))
      const newC = Math.max(0, Math.min(COLS.length - 1, ci + dc))
      setActive({ r: newR, c: newC })
      if (autoEdit && !COLS[newC]?.readOnly && !COLS[newC]?.checkbox)
        setEditing({ r: newR, c: newC })
    }
  }, [filteredRows, updateCell])

  const cancelEdit = useCallback(() => setEditing(null), [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!active || editing) return
    const { r, c } = active
    const col = COLS[c]

    const activeRow    = filteredRows[r]
    const activeRowRec = activeRow as unknown as Record<string, string>

    // ── Ctrl+C — kopiuj wartość komórki ──────────────────────────────────────
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault()
      let value: string
      if (col.group === 'kooperacje') {
        const coopId = activeRowRec[col.key] ?? ''
        value = cooperations.find(c => String(c.id) === coopId)?.name ?? ''
      } else if (col.checkbox) {
        value = (activeRow as unknown as Record<string, unknown>)[col.key] ? '1' : '0'
      } else if (col.group === 'operacje') {
        value = activeRowRec[col.key] ?? ''
      } else {
        value = getCellValue(col, activeRow, r + 1)
      }
      navigator.clipboard.writeText(value).catch(console.error)
      return
    }

    if (col.key === 'przerobka' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault(); openPrzerobkaModal(r); return
    }
    if (col.checkbox && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault(); toggleCheckbox(r, col.key as 'handlowka'); return
    }
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); moveTo(r, c + 1); break
      case 'ArrowLeft':  e.preventDefault(); moveTo(r, c - 1); break
      case 'ArrowDown':  e.preventDefault(); moveTo(r + 1, c); break
      case 'ArrowUp':    e.preventDefault(); moveTo(r - 1, c); break
      case 'Tab':        e.preventDefault(); moveTo(r, e.shiftKey ? c - 1 : c + 1); break
      case 'Enter': case 'F2': e.preventDefault(); startEditing(r, c); break
      case 'Delete': case 'Backspace':
        if (!col.readOnly && !col.checkbox) {
          e.preventDefault()
          if (col.group === 'operacje') {
            updateCell(activeRow.id, col.key + '_seq', '')
            operationLogsApi.save({
              part_id:         activeRow.id,
              operation_id:    OPERATION_MAP[col.key],
              time_estimated:  activeRowRec[col.key] ? parseFloat(activeRowRec[col.key]) : null,
              operation_order: null,
              phase_id:        null,
            }).catch(console.error)
          } else if (col.group === 'kooperacje') {
            updateCell(activeRow.id, col.key, '')
            cooperationLogApi.save({ part_id: activeRow.id, cooperation_id: null, slot: KOP_SLOT[col.key] }).catch(console.error)
          } else {
            updateCell(activeRow.id, col.key, '')
            if (col.key === 'col_a' || col.key === 'col_b' || col.key === 'col_c') {
              formLogApi.saveDims({
                part_id:   activeRow.id,
                dim_a_est: col.key === 'col_a' ? null : (activeRowRec['col_a'] ? parseFloat(activeRowRec['col_a']) : null),
                dim_b_est: col.key === 'col_b' ? null : (activeRowRec['col_b'] ? parseFloat(activeRowRec['col_b']) : null),
                dim_c_est: col.key === 'col_c' ? null : (activeRowRec['col_c'] ? parseFloat(activeRowRec['col_c']) : null),
              }).then(() => syncPhase(activeRow.id))
                .catch(console.error)
            }
          }
        }
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !col.readOnly && !col.checkbox) startEditing(r, c)
    }
  }, [active, cooperations, editing, filteredRows, moveTo, openPrzerobkaModal, startEditing, syncPhase, toggleCheckbox, updateCell])

  // ── Zamknij modal (bez zmiany stanu detalu) ───────────────────────────────
  const closeModal = () => {
    setPrzerobkaIdx(null)
    setSelectedParentId(null)
    setSearchResults([])
  }

  // ── Wyszukiwanie detali do przeróbki ──────────────────────────────────────
  const searchQuery = przerobkaIdx !== null ? (filteredRows[przerobkaIdx]?.oryginalny_detal ?? '') : ''
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(() => {
      partsApi.search(searchQuery)
        .then(setSearchResults)
        .catch(console.error)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const modalRow         = przerobkaIdx !== null ? filteredRows[przerobkaIdx] : null
  const totalCzas        = rows.reduce((s, r) => s + sumRow(r), 0)
  const filteredMaterials    = materials.filter(m => m.density != null && m.cost != null)
  const filteredCooperations = cooperations.filter(c => c.price != null)

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: BG_PAGE }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: BTN_BG, borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
        <span style={{ color: '#6b7280', fontSize: 13 }}>Ładowanie...</span>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: BG_PAGE }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontWeight: 600 }}>Błąd: {error}</p>
        <button onClick={() => navigate('/orders')} style={{ marginTop: 12, padding: '8px 20px', background: BTN_BG, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          ← Powrót
        </button>
      </div>
    </div>
  )

  // ── thStyle ───────────────────────────────────────────────────────────────
  const thStyle = (col: ColDef, w: number, isActive = false, firstRow = true): React.CSSProperties => {
    const bg = isActive ? GROUP_BG_ACTIVE[col.group] : GROUP_BG[col.group]
    return {
      background: bg, color: GROUP_TEXT[col.group],
      fontWeight: 700, fontSize: 12, textAlign: 'center',
      padding: '5px 6px', whiteSpace: 'nowrap',
      width: w, minWidth: w, maxWidth: w,
      borderTop: firstRow ? BORDER : 'none', borderLeft: 'none',
      borderRight: BORDER, borderBottom: BORDER,
      transition: 'background 0.1s',
      ...(col.stickyIdx !== undefined
        ? { position: 'sticky' as const, left: WS_LEFT[col.stickyIdx], zIndex: 3 }
        : {}),
    }
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG_PAGE, overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, background: '#fff', borderBottom: BORDER,
        padding: '8px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'relative',
      }}>
        {/* Wróć */}
        <button
          onClick={() => navigate('/orders')}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: 13, fontWeight: 600, padding: '4px 0', flexShrink: 0 }}
        >
          ← Zamówienia
        </button>

        {/* Tytuł absolutnie wyśrodkowany */}
        <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 400 }}>Numer Zamówienia: </span>
          <strong style={{ fontSize: 16, color: '#1d4ed8', fontWeight: 700, marginLeft: 6 }}>{decoded}</strong>
        </div>

        {/* Logo */}
        <img src="/Logo.png" alt="ProMate" style={{ height: 30, objectFit: 'contain', flexShrink: 0 }} />
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={() => containerRef.current?.focus()}
          style={{ flex: 1, overflow: 'auto', outline: 'none' }}
        >
          <div style={{ background: '#fff', borderLeft: BORDER, borderRight: BORDER, borderTop: BORDER, boxSizing: 'border-box' }}>
            <table style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <colgroup>
                {COLS.map((col, i) => <col key={col.key} style={{ width: colWidths[i] }} />)}
              </colgroup>

              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>

                {/* ── Wiersz 1: etykiety (non-op rowSpan=2) + sumy operacji ── */}
                <tr>
                  {COLS.map((col, ci) => {
                    const isOp = col.group === 'operacje'
                    if (!isOp) {
                      const isSortable   = SORTABLE_COLS.has(col.key)
                      const isFilterable = FILTERABLE_COLS.has(col.key)
                      const hasFilter    = !!colFilters[col.key]?.trim()
                      return (
                        <th key={col.key} rowSpan={showFilterRow ? 2 : 2}
                          style={{
                            ...thStyle(col, colWidths[ci], active?.c === ci, true),
                            ...(col.key === 'suma_czasu' ? {
                              background: active?.c === ci ? GROUP_BG_ACTIVE.operacje : GROUP_BG.operacje,
                              color: GROUP_TEXT.operacje,
                            } : {}),
                            cursor: isSortable ? 'pointer' : 'default',
                          }}
                          onClick={isSortable ? e => toggleSort(col.key, e) : undefined}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center' }}>
                              {col.label}
                              {isSortable && (
                                <span style={{ fontSize: 9, opacity: sortCol === col.key ? 1 : 0.4, color: sortCol === col.key ? '#2563eb' : 'inherit' }}>
                                  {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                                </span>
                              )}
                            </span>
                            {isFilterable && (
                              <span
                                title="Filtruj"
                                onClick={e => openFilter(col.key, e)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  padding: '1px 3px', borderRadius: 3,
                                  background: hasFilter ? '#2563eb' : 'transparent',
                                  color: hasFilter ? '#fff' : '#94a3b8',
                                  fontSize: 9, lineHeight: 1, cursor: 'pointer', flexShrink: 0,
                                }}
                              >▽</span>
                            )}
                          </span>
                        </th>
                      )
                    }
                    // Operacje: wiersz 1 — suma
                    const val = totalColValue(col, filteredRows)
                    return (
                      <th key={col.key} style={{
                        background: GROUP_BG.operacje, color: GROUP_TEXT.operacje,
                        padding: '2px 6px', height: 20,
                        borderTop: BORDER, borderLeft: 'none',
                        borderRight: BORDER, borderBottom: BORDER,
                        fontSize: 12, fontWeight: 700,
                        textAlign: 'center', whiteSpace: 'nowrap',
                        opacity: val ? 1 : 0.4,
                      }}>
                        {val || '—'}
                      </th>
                    )
                  })}
                </tr>

                {/* ── Wiersz 2: tylko etykiety kolumn operacji ─────────────── */}
                <tr>
                  {COLS.filter(c => c.group === 'operacje').map(col => {
                    const ci = COLS.findIndex(c => c.key === col.key)
                    return (
                      <th key={col.key} style={thStyle(col, colWidths[ci], active?.c === ci, false)}>
                        {col.label}
                      </th>
                    )
                  })}
                </tr>

                {/* ── Wiersz 3: filtry (gdy showFilterRow) ─────────────────── */}
                {showFilterRow && (
                  <tr>
                    {COLS.map((col, ci) => {
                      const stickyStyle: React.CSSProperties = col.stickyIdx !== undefined
                        ? { position: 'sticky', left: WS_LEFT[col.stickyIdx], zIndex: 4 }
                        : {}
                      return (
                        <td key={col.key} style={{
                          ...stickyStyle,
                          background: '#eff6ff',
                          padding: 2, width: colWidths[ci], minWidth: colWidths[ci], maxWidth: colWidths[ci],
                          borderTop: 'none', borderLeft: 'none', borderRight: BORDER, borderBottom: BORDER,
                          boxSizing: 'border-box',
                        }}>
                          {FILTERABLE_COLS.has(col.key) && (
                            <input
                              ref={filterCol === col.key ? filterInputRef : null}
                              value={colFilters[col.key] ?? ''}
                              onChange={e => setColFilters(f => ({ ...f, [col.key]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  setShowFilterRow(false)
                                if (e.key === 'Escape') { setColFilters(f => { const n = {...f}; delete n[col.key]; return n }); setShowFilterRow(false) }
                              }}
                              placeholder="Szukaj..."
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                border: '1px solid #93c5fd', borderRadius: 3,
                                padding: '2px 6px', fontSize: 12, outline: 'none', background: '#fff',
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
                {filteredRows.map((row, ri) => {
                  const isRowActive = active?.r === ri
                  return (
                    <tr key={row.id}>
                      {COLS.map((col, ci) => {
                        const isActive  = isRowActive && active?.c === ci
                        const isEditing = editing?.r === ri && editing?.c === ci

                        if (col.key === 'lp') {
                          const bg = isActive ? BG_CELL_ACTIVE : isRowActive ? BG_ROW_ACTIVE : '#fff'
                          return (
                            <td key={col.key} style={{
                              ...stickyBase(col, bg),
                              height: ROW_H, padding: 0,
                              borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
                              outline: isActive ? `2px solid ${ACTIVE_RING}` : 'none',
                              outlineOffset: -2, boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden',
                            }} onClick={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}>
                              <div style={{ height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                                <span
                                  onClick={e => { e.stopPropagation(); window.open(`/karta-produkcyjna/${row.id}`, '_blank') }}
                                  style={{ color: '#1d4ed8', cursor: 'pointer', fontWeight: 500 }}
                                  title="Otwórz kartę wyrobu"
                                >
                                  {ri + 1}
                                </span>
                              </div>
                            </td>
                          )
                        }
                        if (col.key === 'numer_detalu') {
                          const bg = isActive ? BG_CELL_ACTIVE : isRowActive ? BG_ROW_ACTIVE : '#fff'
                          return (
                            <td key={col.key} style={{
                              ...stickyBase(col, bg),
                              height: ROW_H, padding: 0,
                              borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
                              outline: isActive ? `2px solid ${ACTIVE_RING}` : 'none',
                              outlineOffset: -2, boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden',
                            }} onClick={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}>
                              <div style={{ padding: '0 6px', height: ROW_H, display: 'flex', alignItems: 'center', fontSize: 13 }}>
                                <span
                                  onClick={e => {
                                    e.stopPropagation()
                                    const pdfPath = partPaths.get(row.id)?.PDF_path
                                    const url = pdfPath
                                      ? `/api/file?path=${encodeURIComponent(pdfPath)}`
                                      : `/api/parts/${row.id}/pdf`
                                    window.open(url, '_blank')
                                  }}
                                  style={{ color: '#1d4ed8', cursor: 'pointer', fontWeight: 500 }}
                                  title="Otwórz PDF rysunku"
                                >
                                  {row.numer_detalu}
                                </span>
                              </div>
                            </td>
                          )
                        }
                        if (col.key === 'przerobka') {
                          const bg = isActive ? BG_CELL_ACTIVE : isRowActive ? BG_ROW_ACTIVE : '#fff'
                          return (
                            <td key={col.key} style={{
                              height: ROW_H, padding: 0, cursor: 'pointer',
                              borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
                              background: bg, outline: isActive ? `2px solid ${ACTIVE_RING}` : 'none',
                              outlineOffset: -2, boxSizing: 'border-box',
                            }} onClick={() => openPrzerobkaModal(ri)}>
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: ROW_H }}>
                                <div style={{
                                  width: 16, height: 16,
                                  border: `1.5px solid ${row.przerobka ? BTN_BG : '#d1d5db'}`,
                                  borderRadius: 3, background: row.przerobka ? BTN_BG : 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {row.przerobka && <span style={{ color: 'white', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                                </div>
                              </div>
                            </td>
                          )
                        }
                        if (col.checkbox) {
                          return (
                            <CheckboxCell key={col.key} col={col}
                              checked={row[col.key as 'handlowka']}
                              active={isActive} rowActive={isRowActive}
                              onToggle={() => toggleCheckbox(ri, col.key as 'handlowka')}
                            />
                          )
                        }
                        if (col.group === 'operacje') {
                          const rowRec  = row as unknown as Record<string, string>
                          const opId    = OPERATION_MAP[col.key]
                          const usedSeqs = new Set(
                            Object.keys(OPERATION_MAP)
                              .filter(k => k !== col.key)
                              .map(k => rowRec[k + '_seq'])
                              .filter(Boolean)
                          )
                          const saveLog = (time: string, seq: string) => {
                            operationLogsApi.save({
                              part_id:         row.id,
                              operation_id:    opId,
                              time_estimated:  time ? parseFloat(time) : null,
                              operation_order: seq  ? parseInt(seq)    : null,
                              phase_id:        null,
                            }).then(() => syncPhase(row.id))
                              .catch(console.error)
                          }
                          return (
                            <OpCell key={col.key}
                              timeVal={rowRec[col.key] ?? ''}
                              seqVal={rowRec[col.key + '_seq'] ?? ''}
                              usedSeqs={usedSeqs}
                              active={isActive} rowActive={isRowActive} editing={isEditing}
                              onActivate={() => {
                                setActive({ r: ri, c: ci }); containerRef.current?.focus()
                                if (!rowRec[col.key + '_seq']) {
                                  const next = OP_SEQ_OPTIONS.find(n => !usedSeqs.has(n)) ?? ''
                                  if (next) { updateCell(row.id, col.key + '_seq', next); saveLog(rowRec[col.key], next) }
                                }
                              }}
                              onAfterSelect={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}
                              onStartEdit={() => startEditing(ri, ci)}
                              onUpdateTime={v => { updateCell(row.id, col.key, v); saveLog(v, rowRec[col.key + '_seq']) }}
                              onUpdateSeq={v => { updateCell(row.id, col.key + '_seq', v); saveLog(rowRec[col.key], v) }}
                              onCommitAndMove={(dr, dc, _v, ae) => {
                                setEditing(null)
                                if (dr !== 0 || dc !== 0) {
                                  const newR = Math.max(0, Math.min(filteredRows.length - 1, ri + dr))
                                  const newC = Math.max(0, Math.min(COLS.length - 1, ci + dc))
                                  setActive({ r: newR, c: newC })
                                  if (ae && !COLS[newC]?.readOnly && !COLS[newC]?.checkbox)
                                    setEditing({ r: newR, c: newC })
                                }
                              }}
                              onCancelEdit={cancelEdit}
                            />
                          )
                        }
                        if (col.group === 'kooperacje') {
                          const coopId     = (row as unknown as Record<string, string>)[col.key] ?? ''
                          const invalidCoop = !!coopId && !filteredCooperations.some(c => String(c.id) === coopId)
                          const invalidCoopName = invalidCoop ? (cooperations.find(c => String(c.id) === coopId)?.name ?? coopId) : ''
                          return (
                            <KopCell key={col.key}
                              coopId={coopId}
                              cooperations={filteredCooperations}
                              invalid={invalidCoop}
                              invalidName={invalidCoopName}
                              slot={KOP_SLOT[col.key]}
                              active={isActive} rowActive={isRowActive}
                              onActivate={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}
                              onAfterSelect={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}
                              onUpdate={id => {
                                updateCell(row.id, col.key, id)
                                cooperationLogApi.save({
                                  part_id:        row.id,
                                  cooperation_id: id ? parseInt(id) : null,
                                  slot:           KOP_SLOT[col.key],
                                }).catch(console.error)
                              }}
                            />
                          )
                        }
                        if (col.key === 'material') {
                          const matId     = row.material
                          const invalidMat = !!matId && !filteredMaterials.some(m => String(m.id) === matId)
                          const bg = isActive ? GROUP_BG_ACTIVE.dodatkowe : isRowActive ? '#f0fdfa' : '#fff'
                          return (
                            <td key={col.key} style={{
                              minWidth: colWidths[ci], maxWidth: colWidths[ci], width: colWidths[ci],
                              padding: 0, borderRight: BORDER, borderBottom: BORDER, borderTop: 'none', borderLeft: 'none',
                              outline: isActive ? `2px solid ${GROUP_TEXT.dodatkowe}` : invalidMat ? '2px solid #f97316' : 'none',
                              outlineOffset: -1,
                              background: bg, boxSizing: 'border-box',
                            }} onClick={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}>
                              <select
                                value={matId}
                                onChange={e => {
                                  e.stopPropagation()
                                  const val = e.target.value
                                  updateCell(row.id, 'material', val)
                                  formLogApi.saveMaterialEst(row.id, val ? parseInt(val) : null).catch(console.error)
                                }}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => {
                                  if (e.key === 'Delete' || e.key === 'Backspace') {
                                    e.preventDefault(); e.stopPropagation()
                                    updateCell(row.id, 'material', '')
                                    formLogApi.saveMaterialEst(row.id, null).catch(console.error)
                                  }
                                }}
                                style={{
                                  width: '100%', height: ROW_H - 1,
                                  border: 'none', outline: 'none', fontSize: 12,
                                  background: invalidMat ? '#fff7ed' : matId ? '#e0fdf4' : bg,
                                  color: invalidMat ? '#c2410c' : matId ? GROUP_TEXT.dodatkowe : '#9ca3af',
                                  fontWeight: matId ? 600 : 400,
                                  padding: '0 6px', cursor: 'pointer',
                                }}
                              >
                                <option value="">—</option>
                                {invalidMat && (
                                  <option value={matId} style={{ color: '#c2410c', fontStyle: 'italic' }}>
                                    {materials.find(m => String(m.id) === matId)?.name ?? matId}
                                  </option>
                                )}
                                {filteredMaterials.map(m => (
                                  <option key={m.id} value={String(m.id)}
                                    style={{
                                      background: String(m.id) === matId ? '#e0fdf4' : '#fff',
                                      color:      String(m.id) === matId ? GROUP_TEXT.dodatkowe : '#0f172a',
                                      fontWeight: String(m.id) === matId ? 700 : 400,
                                    }}
                                  >
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )
                        }
                        return (
                          <Cell key={col.key} col={col}
                            value={getCellValue(col, row, ri + 1)}
                            active={isActive} rowActive={isRowActive} editing={isEditing}
                            onActivate={() => { setActive({ r: ri, c: ci }); containerRef.current?.focus() }}
                            onStartEdit={() => startEditing(ri, ci)}
                            onCommitAndMove={(dr, dc, v, ae) => {
                              commitAndMove(row.id, ci, dr, dc, v, ae)
                              if (col.key === 'col_a' || col.key === 'col_b' || col.key === 'col_c') {
                                const rowRec = row as unknown as Record<string, string>
                                const dimA = col.key === 'col_a' ? v : (rowRec['col_a'] || '')
                                const dimB = col.key === 'col_b' ? v : (rowRec['col_b'] || '')
                                const dimC = col.key === 'col_c' ? v : (rowRec['col_c'] || '')
                                formLogApi.saveDims({
                                  part_id:   row.id,
                                  dim_a_est: dimA ? parseFloat(dimA) : null,
                                  dim_b_est: dimB ? parseFloat(dimB) : null,
                                  dim_c_est: dimC ? parseFloat(dimC) : null,
                                }).then(() => syncPhase(row.id))
                                  .catch(console.error)
                              }
                            }}
                            onCancelEdit={cancelEdit}
                          />
                        )
                      })}
                    </tr>
                  )
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={COLS.length + 1} style={{
                      textAlign: 'center', padding: '40px 20px',
                      color: '#94a3b8', fontSize: 13, fontStyle: 'italic',
                      borderRight: BORDER, borderBottom: BORDER,
                    }}>
                      Brak danych
                    </td>
                  </tr>
                )}

                {/* ── Wiersz dodawania nowego detalu ── */}
                {orderId != null && (() => {
                  const NR_STYLE: React.CSSProperties = {
                    height: ROW_H, padding: '0 6px', fontSize: 12,
                    border: 'none', outline: 'none', width: '100%',
                    background: 'transparent', boxSizing: 'border-box',
                  }
                  const submitNewRow = async () => {
                    const { numer_detalu, nazwa_detalu, ilosc, termin_wyk } = newRow
                    if (!numer_detalu.trim() || !nazwa_detalu.trim() || newRowSaving) return
                    setNewRowSaving(true)
                    try {
                      const qty = parseInt(ilosc, 10) || 1
                      let deadlineAt: string | null = null
                      if (termin_wyk) {
                        const [d, m, y] = termin_wyk.split('.')
                        if (d && m && y) deadlineAt = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
                        else deadlineAt = termin_wyk
                      }
                      const { id: newId } = await partsApi.create({
                        order_id:      orderId!,
                        part_number:   numer_detalu.trim(),
                        name:          nazwa_detalu.trim(),
                        quantity_right: qty,
                        deadline_at:   deadlineAt,
                      })
                      const newPart = await partsApi.getById(newId)
                      setRows(prev => [...prev, partToRow(newPart as unknown as Part, decoded, deadlineAt ? new Date(deadlineAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')])
                      setNewRow({ numer_detalu: '', nazwa_detalu: '', ilosc: '1', termin_wyk: '' })
                    } catch (e) { console.error('create part error:', e) }
                    finally { setNewRowSaving(false) }
                  }
                  const tdBase: React.CSSProperties = {
                    height: ROW_H, borderRight: BORDER, borderBottom: BORDER,
                    borderTop: 'none', borderLeft: 'none', background: '#f0fdf4',
                    padding: 0, boxSizing: 'border-box',
                  }
                  return (
                    <tr style={{ background: '#f0fdf4' }}>
                      {COLS.map(col => {
                        if (col.key === 'lp') return (
                          <td key="lp" style={{ ...tdBase, ...stickyBase(col, '#f0fdf4'), textAlign: 'center', fontSize: 16, color: '#16a34a', fontWeight: 700 }}>+</td>
                        )
                        if (col.key === 'numer_zlecenia') return (
                          <td key="numer_zlecenia" style={{ ...tdBase, ...stickyBase(col, '#f0fdf4') }}>
                            <div style={{ ...NR_STYLE, display: 'flex', alignItems: 'center', color: '#6b7280', fontStyle: 'italic' }}>{decoded}</div>
                          </td>
                        )
                        if (col.key === 'termin_wyk') return (
                          <td key="termin_wyk" style={{ ...tdBase, ...stickyBase(col, '#f0fdf4') }} onClick={e => e.stopPropagation()}>
                            <input
                              placeholder="DD.MM.RRRR"
                              value={newRow.termin_wyk}
                              onChange={e => setNewRow(r => ({ ...r, termin_wyk: e.target.value }))}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') (e.currentTarget.closest('tr')?.querySelector('[data-field="nr"]') as HTMLInputElement)?.focus() }}
                              style={{ ...NR_STYLE, color: '#374151' }}
                            />
                          </td>
                        )
                        if (col.key === 'numer_detalu') return (
                          <td key="numer_detalu" style={{ ...tdBase, ...stickyBase(col, '#f0fdf4') }} onClick={e => e.stopPropagation()}>
                            <input
                              data-field="nr"
                              placeholder="Nr detalu *"
                              value={newRow.numer_detalu}
                              onChange={e => setNewRow(r => ({ ...r, numer_detalu: e.target.value }))}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') (e.currentTarget.closest('tr')?.querySelector('[data-field="nazwa"]') as HTMLInputElement)?.focus() }}
                              style={{ ...NR_STYLE, fontWeight: 600 }}
                            />
                          </td>
                        )
                        if (col.key === 'nazwa_detalu') return (
                          <td key="nazwa_detalu" style={{ ...tdBase, ...stickyBase(col, '#f0fdf4') }} onClick={e => e.stopPropagation()}>
                            <input
                              data-field="nazwa"
                              placeholder="Nazwa *"
                              value={newRow.nazwa_detalu}
                              onChange={e => setNewRow(r => ({ ...r, nazwa_detalu: e.target.value }))}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') (e.currentTarget.closest('tr')?.querySelector('[data-field="ilosc"]') as HTMLInputElement)?.focus() }}
                              style={{ ...NR_STYLE }}
                            />
                          </td>
                        )
                        if (col.key === 'ilosc') return (
                          <td key="ilosc" style={{ ...tdBase, ...stickyBase(col, '#f0fdf4') }} onClick={e => e.stopPropagation()}>
                            <input
                              data-field="ilosc"
                              type="number"
                              min={1}
                              value={newRow.ilosc}
                              onChange={e => setNewRow(r => ({ ...r, ilosc: e.target.value }))}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submitNewRow() } }}
                              onBlur={submitNewRow}
                              disabled={newRowSaving}
                              style={{ ...NR_STYLE, textAlign: 'center' }}
                            />
                          </td>
                        )
                        return <td key={col.key} style={tdBase} />
                      })}
                    </tr>
                  )
                })()}
              </tbody>
            </table>

          </div>
        </div>

        {/* ── Panel brakujących rysunków ──────────────────────────────── */}
        {(() => {
          const missing = rows.filter(r => {
            const p = partPaths.get(r.id)
            return !p || !p.PDF_path || !p.DWG_path || !p.STP_path
          })
          if (missing.length === 0) return null
          return (
            <div style={{
              flexShrink: 0, borderTop: '2px solid #fca5a5',
              background: '#fff5f5', padding: '8px 20px',
              maxHeight: 160, overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                {/* Lewa strona — etykieta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Brakujące rysunki
                  </span>
                  <span style={{
                    background: '#dc2626', color: '#fff', borderRadius: 10,
                    fontSize: 11, fontWeight: 700, padding: '1px 7px',
                  }}>
                    {missing.length}
                  </span>
                </div>

                {/* Prawa strona — przyciski + ścieżka */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                  <button
                    onClick={async () => {
                      const r = await dialogApi.selectFolder().catch(() => ({ path: null }))
                      if (r.path) {
                        setSelectedFolder(r.path)
                        setFileMsg(null)
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      border: selectedFolder ? '1px solid #2563eb' : '1px solid #fca5a5',
                      borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                      background: selectedFolder ? '#eff6ff' : '#fff',
                      color: selectedFolder ? '#1d4ed8' : '#b91c1c',
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    {selectedFolder
                      ? selectedFolder.split(/[\\/]/).filter(Boolean).at(-1) ?? selectedFolder
                      : 'Wybierz Folder'
                    }
                  </button>

                  <button
                    disabled={!selectedFolder || loadingFiles}
                    onClick={async () => {
                      if (!selectedFolder) return
                      setFileMsg(null)
                      const missingParts = rows
                        .filter(r => {
                          const p = partPaths.get(r.id)
                          return !p || !p.PDF_path || !p.DWG_path || !p.STP_path
                        })
                        .map(r => {
                          const p = partPaths.get(r.id)
                          return {
                            id:          r.id,
                            part_number: r.numer_detalu,
                            needsPDF:    !p?.PDF_path,
                            needsDWG:    !p?.DWG_path,
                            needsSTP:    !p?.STP_path,
                          }
                        })
                      if (!missingParts.length) return
                      setLoadingFiles(true)
                      try {
                        const result = await partsApi.loadFromFolder(selectedFolder, orderId!, missingParts)
                        const ids   = rows.map(r => r.id)
                        const fresh = await partsApi.getPaths(ids)
                        setPartPaths(new Map(fresh.map(p => [p.part_id, p])))
                        setFileMsg({ text: `Zaktualizowano ${result.updated} z ${missingParts.length} detali`, ok: result.updated > 0 })
                      } catch (err) {
                        console.error('load-from-folder:', err)
                        setFileMsg({ text: `Błąd: ${err instanceof Error ? err.message : String(err)}`, ok: false })
                      } finally {
                        setLoadingFiles(false)
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                      background: selectedFolder && !loadingFiles ? '#dc2626' : '#fca5a5',
                      color: '#fff',
                      cursor: selectedFolder && !loadingFiles ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {loadingFiles ? (
                      <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    )}
                    {loadingFiles ? 'Ładowanie...' : 'Załaduj pliki'}
                  </button>
                </div>
              </div>
              {fileMsg && (
                <div style={{ fontSize: 12, fontWeight: 600, color: fileMsg.ok ? '#166534' : '#991b1b', padding: '2px 0 4px' }}>
                  {fileMsg.ok ? '✓' : '✗'} {fileMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                {missing.map(r => {
                  const p = partPaths.get(r.id)
                  const missingExt = [
                    !p?.PDF_path && 'PDF',
                    !p?.DWG_path && 'DWG',
                    !p?.STP_path && 'STP',
                  ].filter(Boolean).join(', ')
                  const pdfUrl = p?.PDF_path
                    ? `/api/file?path=${encodeURIComponent(p.PDF_path)}`
                    : null
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: '#fff', border: '1px solid #fca5a5',
                      borderRadius: 5, padding: '2px 8px', fontSize: 12,
                    }}>
                      {pdfUrl ? (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontWeight: 600, color: '#1d4ed8', textDecoration: 'none' }}
                          title="Otwórz PDF"
                        >
                          {r.numer_detalu}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{r.numer_detalu}</span>
                      )}
                      <span style={{ color: '#dc2626', fontSize: 11 }}>brak: {missingExt}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Footer na dole ────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0, background: '#fff', borderTop: BORDER,
          padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16,
        }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
            Gotowe: <strong style={{ color: '#0f172a', fontWeight: 700 }}>
              {rows.filter(r => r.phase_id !== null && r.phase_id >= 11).length}
            </strong>
            {' / '}
            <strong style={{ color: '#0f172a', fontWeight: 700 }}>{rows.length}</strong>
          </span>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
            Total czas: <strong style={{ color: '#0f172a', fontWeight: 700 }}>{totalCzas || 0}</strong>
          </span>
          {(() => {
            const doneCount  = rows.filter(r => r.phase_id !== null && r.phase_id >= 11).length
            const allDone    = rows.length > 0 && doneCount === rows.length
            return (
              <button
                disabled={!allDone}
                onClick={() => {
                  if (!orderId || !allDone) return
                  const settings = loadSettings()
                  const printer = settings.printKarta && settings.printer ? settings.printer : undefined
                  setReadyModal({ running: true, pdfOk: null, printEnabled: !!printer, printOk: null, errors: [] })
                  ordersApi.readyForProduction(orderId, printer)
                    .then(res => {
                      const errors = res.pdfErrors ?? []
                      setReadyModal(prev => prev ? {
                        ...prev, running: false,
                        pdfOk: errors.length === 0,
                        printOk: errors.length === 0,
                        errors,
                      } : null)
                    })
                    .catch(err => {
                      setReadyModal(prev => prev ? {
                        ...prev, running: false,
                        pdfOk: false, printOk: false, errors: [err.message],
                      } : null)
                    })
                }}
                style={{
                  background: allDone ? BTN_BG : '#9ca3af',
                  color: 'white', border: 'none',
                  borderRadius: 7, padding: '7px 22px',
                  fontSize: 13, fontWeight: 700,
                  cursor: allDone ? 'pointer' : 'not-allowed',
                  boxShadow: allDone ? '0 2px 8px rgba(14,165,233,0.3)' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (allDone) e.currentTarget.style.background = '#0284c7' }}
                onMouseLeave={e => { if (allDone) e.currentTarget.style.background = BTN_BG }}
              >
                Gotowe do produkcji
              </button>
            )
          })()}
        </div>
      </div>

      {/* ── Modal: Gotowe do produkcji ───────────────────────────────────── */}
      {readyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden' }}>

            {/* Nagłówek */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Gotowe do Produkcji</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>{decoded}</div>
            </div>

            {/* Lista czynności */}
            <div style={{ padding: '4px 24px 0' }}>
              <CheckItem
                label="Dopisano informacje do rysunka"
                done={true}
              />
              <CheckItem
                label="Wygenerowano PDF (Rysunek + Karta Detalu)"
                done={readyModal.running ? null : readyModal.pdfOk}
              />
              <CheckItem
                label="Wydrukowano Karty Detalu"
                done={!readyModal.printEnabled ? 'na' : readyModal.running ? null : readyModal.printOk}
                note={!readyModal.printEnabled ? 'Drukowanie wyłączone w ustawieniach' : undefined}
              />
              <CheckItem
                label="Gotowe do Produkcji"
                done={readyModal.running ? null : true}
              />
            </div>

            {/* Błędy */}
            {readyModal.errors.length > 0 && (
              <div style={{ margin: '12px 24px 4px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>Błędy:</div>
                {readyModal.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#dc2626', marginTop: i > 0 ? 3 : 0 }}>{e}</div>
                ))}
              </div>
            )}

            {/* Przyciski */}
            <div style={{ padding: '16px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setReadyModal(null)}
                style={{ padding: '8px 18px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >Zamknij</button>
              {!readyModal.running && (
                <button
                  onClick={() => { setReadyModal(null); navigate('/orders') }}
                  style={{ padding: '8px 22px', background: BTN_BG, color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >Przejdź do zamówień →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Przeróbka modal ───────────────────────────────────────────────── */}
      {przerobkaIdx !== null && modalRow && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#fff', borderRadius: 10, width: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '18px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: '#fef3c7', border: '1px solid #fcd34d',
                    fontSize: 10, fontWeight: 700, color: '#92400e', letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>Przeróbka</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{modalRow.numer_detalu}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{modalRow.numer_zlecenia}</div>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'none', border: '1px solid #e2e8f0', color: '#94a3b8',
                  borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8' }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>

              {/* Szukaj oryginalnego detalu */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Szukaj oryginalnego detalu
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalRow.oryginalny_detal}
                  onChange={e => { const id = modalRow?.id; setRows(prev => prev.map(row => row.id === id ? { ...row, oryginalny_detal: e.target.value } : row)) }}
                  placeholder="Wpisz fragment numeru detalu..."
                  style={{
                    width: '100%', border: '1px solid #e2e8f0', borderRadius: 7,
                    padding: '9px 12px', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box', color: '#0f172a', background: '#f8fafc',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc' }}
                />
              </div>

              {/* Wyniki wyszukiwania */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Wyniki{searchResults.length > 0 ? ` (${searchResults.length})` : ''}
                  {selectedParentId && (
                    <span style={{ marginLeft: 8, color: '#2563eb', fontWeight: 700 }}>
                      ✓ wybrano #{selectedParentId}
                    </span>
                  )}
                </label>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 7, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ background: '#f8fafc' }}>
                        {['', 'Numer Detalu', 'Nazwa', 'Zlecenie'].map((h, i) => (
                          <th key={i} style={{
                            padding: '8px 10px', fontSize: 11, fontWeight: 600,
                            color: '#64748b', textAlign: i === 0 ? 'center' : 'left',
                            borderBottom: '1px solid #e2e8f0',
                            width: i === 0 ? 36 : undefined,
                            letterSpacing: '0.04em', whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                            {searchQuery.trim() ? 'Brak wyników' : 'Wpisz numer detalu aby wyszukać…'}
                          </td>
                        </tr>
                      )}
                      {searchResults.map(sr => {
                        const isSelected = selectedParentId === sr.id
                        return (
                          <tr
                            key={sr.id}
                            onClick={() => setSelectedParentId(isSelected ? null : sr.id)}
                            style={{ cursor: 'pointer', background: isSelected ? '#eff6ff' : '#fff', transition: 'background 0.08s' }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isSelected ? '#eff6ff' : '#fff' }}
                          >
                            <td style={{ textAlign: 'center', padding: '7px 8px', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%', margin: '0 auto',
                                border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`,
                                background: isSelected ? '#2563eb' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                              </div>
                            </td>
                            <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                              {sr.part_number}
                            </td>
                            <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#475569', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sr.name}
                            </td>
                            <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#94a3b8' }}>
                              {sr.order_number}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Przyciski */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                {/* Usuń powiązanie — tylko gdy jest już przypisana część */}
                <div>
                  {modalRow?.przerobka && (
                    <button
                      onClick={() => {
                        if (!modalRow) return
                        partsApi.setRework(modalRow.id, null).catch(console.error)
                        setRows(prev => prev.map(r => r.id === modalRow.id ? { ...r, przerobka: false, rework_parent_part_id: null } : r))
                        closeModal()
                      }}
                      style={{ padding: '8px 16px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
                    >Usuń powiązanie</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={closeModal}
                  style={{ padding: '8px 20px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#9ca3af' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db' }}
                >Anuluj</button>
                <button
                  disabled={!selectedParentId}
                  onClick={() => {
                    if (!modalRow || !selectedParentId) return
                    partsApi.setRework(modalRow.id, selectedParentId).catch(console.error)
                    setRows(prev => prev.map(r => r.id === modalRow.id ? { ...r, przerobka: true, rework_parent_part_id: selectedParentId } : r))
                    setPrzerobkaIdx(null); setSelectedParentId(null); setSearchResults([])
                  }}
                  style={{ padding: '8px 24px', background: selectedParentId ? '#2563eb' : '#93c5fd', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: selectedParentId ? 'pointer' : 'not-allowed', boxShadow: selectedParentId ? '0 1px 4px rgba(37,99,235,0.3)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (selectedParentId) e.currentTarget.style.background = '#1d4ed8' }}
                  onMouseLeave={e => { e.currentTarget.style.background = selectedParentId ? '#2563eb' : '#93c5fd' }}
                >Zapisz</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
