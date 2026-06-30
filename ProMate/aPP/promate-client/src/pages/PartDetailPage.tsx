import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ordersApi, formLogApi, operationLogsApi, cooperationLogApi,
  priceApi, materialsApi, cooperationsApi, operationsApi, partsApi, dialogApi, phasesApi,
} from '../services/api'
import type { Part } from '../types'
import type {
  FormLogDims, OperationLog, CooperationLog, PartPaths,
  Price, Material, Cooperation, Operation, PhaseInfo,
} from '../services/api'

// ─── FilePathInput ────────────────────────────────────────────────────────────

function FilePathInput({
  pathKey, label, initialPath, partId, onSaved,
}: {
  pathKey: 'PDF_path' | 'DWG_path' | 'STP_path'
  label: string
  initialPath: string | null
  partId: number
  onSaved: (key: 'PDF_path' | 'DWG_path' | 'STP_path', newPath: string | null) => void
}) {
  const [value, setValue] = useState(initialPath ?? '')

  useEffect(() => { setValue(initialPath ?? '') }, [initialPath])

  const save = async () => {
    const trimmed = value.trim().replace(/^"+|"+$/g, '').trim() || null
    if (trimmed === initialPath) return
    await partsApi.updatePaths(partId, { [pathKey]: trimmed })
    onSaved(pathKey, trimmed)
  }

  const hasPath = !!initialPath

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16, lineHeight: 1, color: hasPath ? '#16a34a' : '#dc2626' }}>
        {hasPath ? '✓' : '✗'}
      </span>
      <span style={{ fontWeight: 700, fontSize: 13, minWidth: 36, color: '#374151' }}>{label}</span>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        placeholder="Wklej ścieżkę..."
        style={{
          flex: 1, fontSize: 11, color: '#374151', padding: '3px 6px',
          border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb',
          minWidth: 0, fontFamily: 'monospace',
        }}
      />
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartInfo {
  part:        Part
  orderNumber: string
  deadlineAt:  string | null
}

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

// ─── Mapping operacji ─────────────────────────────────────────────────────────

const OP_ID_TO_LABEL: Record<number, string> = {
  1: 'PLOTER', 2: 'FKG', 3: 'FKO', 4: 'TOK', 5: 'TOKCNC',
  6: 'FCNC', 7: 'FCNC ROBO', 8: 'PIŁA', 9: 'ŚLUSARNIA', 10: 'SZLIF', 11: 'SPAW',
}
// operacje widoczne w sekcji zamówień na /home (te same co HOME_OP_MAP)
const ORDER_OP_IDS = new Set([1, 2, 3, 4, 5, 6, 7])

// ─── Design ───────────────────────────────────────────────────────────────────

const BORDER  = '1px solid #d1d5db'
const BG_PAGE = '#f0f2f5'
const BLUE    = '#1d4ed8'
const TH_BG   = '#e8edf2'
const TH_TEXT = '#1e293b'

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#1e293b',
  marginBottom: 14, marginTop: 0,
  paddingBottom: 8, borderBottom: '2px solid #1d4ed8',
  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
}
const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#64748b',
  display: 'block', marginBottom: 4,
  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
}
const fieldValue: React.CSSProperties = {
  color: '#0f172a', fontSize: 15, fontWeight: 600,
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 0,
  border: BORDER, borderTop: '3px solid #1d4ed8',
  padding: '18px 20px', marginBottom: 12,
}
const tblTh: React.CSSProperties = {
  background: TH_BG, color: TH_TEXT, fontWeight: 700, fontSize: 12,
  padding: '8px 12px', border: BORDER, textAlign: 'center',
  whiteSpace: 'nowrap',
}
const tblTd: React.CSSProperties = {
  padding: '7px 10px', fontSize: 14,
  border: BORDER, textAlign: 'center', color: '#0f172a',
}
const infoBox: React.CSSProperties = {
  borderRadius: 0, padding: '12px 14px',
  background: '#f8fafc', border: BORDER,
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  D4:   { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  D6:   { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  D7:   { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  D8:   { bg: '#ede9fe', text: '#6d28d9', dot: '#8b5cf6' },
  D9:   { bg: '#fce7f3', text: '#be185d', dot: '#ec4899' },
  D10:  { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  D11:  { bg: '#e0f2fe', text: '#0369a1', dot: '#0ea5e9' },
  D100: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  D101: { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' },
  D102: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string | Date | null | undefined): string {
  if (!s) return ''
  try {
    return new Date(s as string).toLocaleDateString('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return String(s) }
}

function fmt(v: number | null | undefined, unit = ''): string {
  if (v == null) return ''
  return `${v}${unit ? ' ' + unit : ''}`
}

function Dash() { return <span style={{ color: '#cbd5e1' }}>—</span> }

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <span style={fieldLabel}>{label}</span>
      <span style={fieldValue}>{value != null && value !== '' ? value : <Dash />}</span>
    </div>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} style={{ ...tblTd, color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
        Brak danych
      </td>
    </tr>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PartDetailContent({ numer_detalu: rawNum, part_id: propPartId, onClose, onOperationTimeUpdated, onPathSaved }: {
  numer_detalu?: string
  part_id?: number
  onClose?: () => void
  onOperationTimeUpdated?: (partId: number, operationId: number, timeEstimated: number | null) => void
  onPathSaved?: (partId: number, pathKey: 'PDF_path' | 'DWG_path' | 'STP_path', val: string | null) => void
}) {
  const navigate = useNavigate()
  const decoded  = rawNum ? decodeURIComponent(rawNum) : ''

  const [info,      setInfo]      = useState<PartInfo | null>(null)
  const [formLog,   setFormLog]   = useState<FormLogDims | null>(null)
  const [opLogs,    setOpLogs]    = useState<OperationLog[]>([])
  const [copLogs,   setCopLogs]   = useState<CooperationLog[]>([])
  const [price,     setPrice]     = useState<Price | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [coops,     setCoops]     = useState<Cooperation[]>([])
  const [ops,       setOps]       = useState<Operation[]>([])
  const [paths,     setPaths]     = useState<PartPaths | null>(null)
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState<string | null>(null)
  const [editingOp,         setEditingOp]         = useState<{ operationId: number; value: string } | null>(null)
  const [d100PhaseId,       setD100PhaseId]       = useState<number | null>(null)
  const [d102PhaseId,       setD102PhaseId]       = useState<number | null>(null)
  const [allPhases,         setAllPhases]         = useState<PhaseInfo[]>([])
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling,        setCancelling]        = useState(false)
  const [suspending,        setSuspending]        = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [summaries, mats, cps, operations, phases] = await Promise.all([
          ordersApi.getSummaryList(),
          materialsApi.getAll(),
          cooperationsApi.getAll(),
          operationsApi.getAll(),
          phasesApi.getByType('part'),
        ])
        if (cancelled) return
        setMaterials(mats)
        setCoops(cps)
        setOps(operations)
        setD100PhaseId(phases.find(p => p.name === 'D100')?.id ?? null)
        setD102PhaseId(phases.find(p => p.name === 'D102')?.id ?? null)
        setAllPhases(phases)

        const deadlineMap = new Map(summaries.map(s => [s.order_number, s.deadline_at]))

        let found: PartInfo | null = null

        if (propPartId) {
          // Szybka ścieżka: lookup po ID
          const partWithOrder = await partsApi.getById(propPartId)
          if (!cancelled && partWithOrder) {
            found = {
              part:        partWithOrder as unknown as Part,
              orderNumber: partWithOrder.order_number,
              deadlineAt:  deadlineMap.get(partWithOrder.order_number) ?? null,
            }
          }
        } else {
          // Ścieżka przez numer detalu (standalone route)
          const orders = await ordersApi.getAll()
          if (!cancelled) {
            const nested = await Promise.all(
              orders.map(o =>
                ordersApi.getParts(o.id).then(parts =>
                  parts.map(p => ({ part: p, orderNumber: o.order_number, deadlineAt: deadlineMap.get(o.order_number) ?? null }))
                )
              )
            )
            found = nested.flat().find(x => x.part.part_number === decoded) ?? null
          }
        }

        if (cancelled) return
        if (!found) {
          setError(`Nie znaleziono detalu: ${decoded || propPartId}`)
          setLoading(false)
          return
        }
        setInfo(found)

        const partId = found.part.id
        const [fls, oLogs, cLogs, prices, pths] = await Promise.all([
          formLogApi.getByPartIds([partId]),
          operationLogsApi.getByPartIds([partId]),
          cooperationLogApi.getByPartIds([partId]),
          priceApi.getByPartIds([partId]),
          partsApi.getPaths([partId]),
        ])
        if (cancelled) return
        setFormLog(fls[0] ?? null)
        setOpLogs(oLogs)
        setCopLogs(cLogs)
        setPrice(prices[0] ?? null)
        setPaths(pths[0] ?? null)
        setLoading(false)
      } catch {
        if (!cancelled) { setError('Błąd połączenia z bazą danych'); setLoading(false) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [decoded, propPartId])

  const part  = info?.part
  const ilosc = part ? (part.quantity_right || 0) + (part.quantity_left || 0) : null
  const iloscDisplay = part
    ? (part.quantity_left > 0
      ? `${part.quantity_right} + ${part.quantity_left}L`
      : String(part.quantity_right))
    : undefined

  // Wymiary formatki
  const matName = formLog?.material_id ? (materials.find(m => m.id === formLog.material_id)?.name ?? '') : ''
  const dimStr  = (() => {
    if (!formLog) return ''
    if (formLog.dim_c_real != null)
      return `${formLog.dim_a_real ?? '?'} × ${formLog.dim_b_real ?? '?'} × ${formLog.dim_c_real} mm`
    if (formLog.dim_a_real != null && formLog.dim_b_real != null)
      return `Śr. ${formLog.dim_a_real} × Dł. ${formLog.dim_b_real} mm`
    return ''
  })()

  // Operacje z time_real
  const opLogsWithTime = opLogs.filter(l => l.time_real != null)

  // Kooperacje
  const copMap = new Map(coops.map(c => [c.id, c.name]))

  // Kolory faz operacji (zgodne z /home)
  const OP_PHASE_BG: Record<number, string>   = { 16: '#ef4444', 17: '#f97316', 18: '#22c55e' }
  const OP_PHASE_TXT: Record<number, string>  = { 16: '#fff',    17: '#fff',    18: '#fff'    }

  const saveOpTime = async (operationId: number, existingLog: OperationLog | null, raw: string) => {
    if (!part) return
    const time = raw.trim() ? parseFloat(raw.trim()) : null
    if (time !== null && isNaN(time)) { setEditingOp(null); return }
    await operationLogsApi.save({
      part_id:         part.id,
      operation_id:    operationId,
      time_estimated:  time,
      operation_order: existingLog?.operation_order ?? null,
      phase_id:        existingLog?.phase_id ?? null,
    })
    setOpLogs(prev => {
      const exists = prev.find(l => l.operation_id === operationId)
      if (exists) return prev.map(l => l.operation_id === operationId ? { ...l, time_estimated: time } : l)
      if (time == null) return prev
      return [...prev, {
        id: Date.now(), part_id: part.id, operation_id: operationId,
        phase_id: null, time_estimated: time, time_real: null,
        operation_order: null, barcode: null, cost: null, notes: null,
      }]
    })
    onOperationTimeUpdated?.(part.id, operationId, time)
    setEditingOp(null)
  }

  const cancelPart = async () => {
    if (!part || !d100PhaseId) return
    setCancelling(true)
    try {
      await partsApi.updatePhase(part.id, d100PhaseId)
      setInfo(prev => prev ? { ...prev, part: { ...prev.part, phase_name: 'D100', phase_id: d100PhaseId } } : prev)
      setShowCancelConfirm(false)
    } catch (e) {
      console.error('cancel part error:', e)
    } finally {
      setCancelling(false)
    }
  }

  const suspendPart = async () => {
    if (!part || !d102PhaseId) return
    setSuspending(true)
    try {
      await partsApi.updatePhase(part.id, d102PhaseId)
      setInfo(prev => prev ? { ...prev, part: { ...prev.part, phase_name: 'D102', phase_id: d102PhaseId } } : prev)
    } catch (e) {
      console.error('suspend part error:', e)
    } finally {
      setSuspending(false)
    }
  }

  const restorePart = async () => {
    if (!part) return
    // Compute target phase from current operation states
    // Operation phase IDs: 16=Oczekuje(r), 17=W realizacji(o), 18=Wykonana(g)
    const timedOps  = opLogs.filter(l => l.time_estimated != null && ORDER_OP_IDS.has(l.operation_id))
    const doneOps   = timedOps.filter(l => l.phase_id === 18)
    const hasStarted = timedOps.some(l => l.phase_id === 17 || l.phase_id === 18)

    let targetName: string
    if (timedOps.length > 0 && doneOps.length === timedOps.length) {
      targetName = 'D8'
    } else if (hasStarted) {
      targetName = 'D7'
    } else {
      targetName = 'D6'
    }

    const targetPhase = allPhases.find(p => p.name === targetName)
    if (!targetPhase) return

    setSuspending(true)
    try {
      await partsApi.updatePhase(part.id, targetPhase.id)
      setInfo(prev => prev ? { ...prev, part: { ...prev.part, phase_name: targetName, phase_id: targetPhase.id } } : prev)
    } catch (e) {
      console.error('restore part error:', e)
    } finally {
      setSuspending(false)
    }
  }

  return (
    <div style={{ background: BG_PAGE, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', background: '#1e40af', borderBottom: '3px solid #1e3a8a', flexShrink: 0, height: 52,
      }}>
        <button
          onClick={() => onClose ? onClose() : navigate(-1)}
          style={{
            border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.1)',
            borderRadius: 0, cursor: 'pointer', color: '#fff',
            fontSize: 13, fontWeight: 600, padding: '6px 14px', lineHeight: 1,
          }}
        >
          {onClose ? '✕ Zamknij' : '← Wróć'}
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#fff' }}>
          Karta Detalu
        </div>
        <img src="/Logo.png" alt="ProMate" style={{ height: 30, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>
          Ładowanie danych…
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 14 }}>
          {error}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', alignItems: 'start', maxWidth: 1200, margin: '0 auto' }}>

            {/* ═══ LEWA KOLUMNA ═══ */}
            <div>

              {/* Informacje podstawowe */}
              <div style={card}>
                <div style={{ marginBottom: 18 }}>
                  <span style={sectionTitle}>Informacje podstawowe</span>
                </div>

                {/* Grid 3-kolumnowy */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 20px', marginBottom: 16 }}>
                  <Field label="Nr Detalu"        value={part?.part_number} />
                  <Field label="Nazwa Detalu"     value={part?.name} />
                  <Field label="Ilość"            value={iloscDisplay} />
                  <Field label="Nr Zlecenia"      value={info?.orderNumber} />
                  <Field label="Termin wykonania" value={formatDate(info?.deadlineAt) || undefined} />
                  <div>
                    <span style={fieldLabel}>Status</span>
                    {part?.phase_name ? (() => {
                      const ph = part.phase_name
                      const c  = STATUS_COLORS[ph]
                      const lb = PHASE_LABELS[ph] ?? ph
                      return c ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.text, fontSize: 11, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                          {lb}
                        </span>
                      ) : <span style={fieldValue}>{lb}</span>
                    })() : <Dash />}
                  </div>
                </div>

                {/* Karta wydrukowana */}
                <div>
                  <span style={fieldLabel}>Karta wydrukowana</span>
                  <span style={{ ...fieldValue, color: part?.card_printed ? '#16a34a' : '#dc2626' }}>
                    {part?.card_printed ? '✓ Tak' : '✗ Nie'}
                  </span>
                </div>

                {/* Anuluj / Wstrzymaj detal */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: BORDER }}>
                  {part?.phase_name === 'D102' ? (
                    <button
                      disabled={suspending}
                      onClick={restorePart}
                      style={{
                        padding: '7px 16px', fontSize: 13, fontWeight: 700,
                        background: '#16a34a', color: '#fff', border: 'none',
                        borderRadius: 0, cursor: suspending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {suspending ? '...' : 'Przywróć Detal'}
                    </button>
                  ) : part?.phase_name === 'D100' ? (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', padding: '6px 14px', display: 'inline-block' }}>
                      ✗ Detal anulowany
                    </span>
                  ) : !showCancelConfirm ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        style={{
                          padding: '7px 16px', fontSize: 13, fontWeight: 700,
                          background: '#fff', color: '#dc2626', border: '1px solid #dc2626',
                          borderRadius: 0, cursor: 'pointer',
                        }}
                      >
                        Anuluj Detal
                      </button>
                      <button
                        disabled={suspending}
                        onClick={suspendPart}
                        style={{
                          padding: '7px 16px', fontSize: 13, fontWeight: 700,
                          background: '#fff', color: '#b45309', border: '1px solid #d97706',
                          borderRadius: 0, cursor: suspending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {suspending ? '...' : 'Wstrzymaj Detal'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Czy na pewno anulować detal?</span>
                      <button
                        disabled={cancelling}
                        onClick={cancelPart}
                        style={{
                          padding: '6px 14px', fontSize: 13, fontWeight: 700,
                          background: '#dc2626', color: '#fff', border: 'none',
                          borderRadius: 0, cursor: cancelling ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {cancelling ? '...' : 'Tak, anuluj'}
                      </button>
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        style={{
                          padding: '6px 14px', fontSize: 13, fontWeight: 600,
                          background: '#fff', color: '#6b7280', border: BORDER,
                          borderRadius: 0, cursor: 'pointer',
                        }}
                      >
                        Nie
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Planowane operacje */}
              <div style={card}>
                <div style={sectionTitle}>Planowane operacje</div>
                {ops.length === 0
                  ? <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12, padding: '4px 0' }}>Ładowanie…</div>
                  : (() => {
                    const logByOpId = new Map(opLogs.map(l => [l.operation_id, l]))
                    const sorted    = [...ops].filter(o => ORDER_OP_IDS.has(o.id)).sort((a, b) => a.id - b.id)
                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {sorted.map(op => (
                                <th key={op.id} style={{ ...tblTh, minWidth: 56 }}>
                                  {op.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {sorted.map(op => {
                                const log       = logByOpId.get(op.id) ?? null
                                const timeEst   = log?.time_estimated ?? null
                                const hasTime   = timeEst != null
                                const phaseId   = log?.phase_id ?? null
                                const bg  = hasTime ? (OP_PHASE_BG[phaseId!]  ?? '#ef4444') : '#f8fafc'
                                const txt = hasTime ? (OP_PHASE_TXT[phaseId!] ?? '#fff')    : '#94a3b8'
                                const isEditing = editingOp?.operationId === op.id
                                return (
                                  <td
                                    key={op.id}
                                    title="Dwuklik aby edytować"
                                    onDoubleClick={() => setEditingOp({ operationId: op.id, value: String(timeEst ?? '') })}
                                    style={{ ...tblTd, background: bg, color: txt, fontWeight: hasTime ? 700 : 400, cursor: 'pointer', userSelect: 'none' }}
                                  >
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        type="number"
                                        value={editingOp!.value}
                                        onChange={e => setEditingOp(prev => prev ? { ...prev, value: e.target.value } : null)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter')  saveOpTime(op.id, log, editingOp!.value)
                                          if (e.key === 'Escape') setEditingOp(null)
                                        }}
                                        onBlur={() => saveOpTime(op.id, log, editingOp!.value)}
                                        style={{ width: 52, textAlign: 'center', fontSize: 12, fontWeight: 700, border: 'none', outline: '2px solid #2563eb', borderRadius: 2, background: '#fff', color: '#1e293b', padding: '1px 2px' }}
                                      />
                                    ) : (hasTime ? timeEst : '')}
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  })()
                }
              </div>

              {/* Kooperacje (wyjazd / przyjazd) */}
              <div style={card}>
                <div style={sectionTitle}>Planowane kooperacje</div>

                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...tblTh, textAlign: 'left', width: 130 }}>Kooperacje:</th>
                      <th style={tblTh}>Wyjazd:</th>
                      <th style={tblTh}>Przyjazd:</th>
                      <th style={{ ...tblTh, width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {copLogs.map(cl => (
                      <tr key={cl.slot}>
                        <td style={{ ...tblTd, textAlign: 'left' }}>{copMap.get(cl.cooperation_id) ?? `Kop. ${cl.slot}`}</td>
                        <td style={tblTd}>{cl.sent_at     ? formatDate(cl.sent_at)     : <Dash />}</td>
                        <td style={tblTd}>{cl.received_at ? formatDate(cl.received_at) : <Dash />}</td>
                        <td style={{ ...tblTd, padding: '2px 4px', width: 28 }}>
                          <button
                            title="Usuń kooperację"
                            onClick={async () => {
                              if (!part) return
                              await cooperationLogApi.save({ part_id: part.id, cooperation_id: null, slot: cl.slot })
                              const updated = await cooperationLogApi.getByPartIds([part.id])
                              setCopLogs(updated)
                            }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#ef4444', fontSize: 14, lineHeight: 1, padding: 2,
                              display: 'flex', alignItems: 'center',
                            }}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(() => {
                      const usedSlots = new Set(copLogs.map(cl => cl.slot))
                      const nextSlot  = [1, 2, 3].find(s => !usedSlots.has(s))
                      if (!nextSlot || !part) return null
                      const available = coops.filter(c => c.price != null && c.unit != null)
                      return (
                        <tr>
                          <td colSpan={4} style={{ ...tblTd, padding: '2px 6px' }}>
                            <select
                              value=""
                              onChange={async e => {
                                const coopId = Number(e.target.value)
                                if (!coopId) return
                                await cooperationLogApi.save({ part_id: part.id, cooperation_id: coopId, slot: nextSlot })
                                const updated = await cooperationLogApi.getByPartIds([part.id])
                                setCopLogs(updated)
                              }}
                              style={{
                                width: '100%', border: 'none', background: 'transparent',
                                cursor: 'pointer', fontSize: 13, color: '#6b7280',
                                outline: 'none', padding: '2px 0',
                              }}
                            >
                              <option value="">+ Dodaj kooperację...</option>
                              {available.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pliki */}
              {part && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={sectionTitle}>Pliki:</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => window.open(`/api/parts/${part.id}/card-pdf`, '_blank')}
                        style={{
                          padding: '3px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                          background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontWeight: 600,
                        }}
                      >
                        📄 Otwórz kartę
                      </button>
                      {paths?.PDF_path && (
                        <button
                          onClick={() => window.open(`/api/file?path=${encodeURIComponent(paths.PDF_path!)}`, '_blank')}
                          style={{
                            padding: '3px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                            background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: 600,
                          }}
                        >
                          🗺️ Otwórz Rysunek
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([
                      { pathKey: 'PDF_path' as const, label: 'PDF' },
                      { pathKey: 'DWG_path' as const, label: 'DWG' },
                      { pathKey: 'STP_path' as const, label: 'STP' },
                    ]).map(({ pathKey, label }) => (
                      <FilePathInput
                        key={pathKey}
                        pathKey={pathKey}
                        label={label}
                        initialPath={paths?.[pathKey] ?? null}
                        partId={part.id}
                        onSaved={(key, newPath) => {
                          setPaths(prev => prev ? { ...prev, [key]: newPath } : prev)
                          onPathSaved?.(part.id, key, newPath)
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ PRAWA KOLUMNA ═══ */}
            <div>

              {/* Formatka */}
              <div style={card}>
                <div style={sectionTitle}>Formatka</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                  <Field label="Wymiary"        value={dimStr || undefined} />
                  <Field label="Materiał"       value={matName || undefined} />
                  <Field label="Masa szt."      value={formLog?.weight_one != null ? fmt(formLog.weight_one, 'kg') : undefined} />
                  <Field label="Pow. obr. szt." value={formLog?.area_one   != null ? fmt(formLog.area_one,   'dm²') : undefined} />
                </div>
                {(formLog?.weight_one != null || formLog?.area_one != null) && ilosc ? (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0f2f5', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                    <Field
                      label="Łączna masa"
                      value={formLog?.weight_one != null ? fmt(Math.round(formLog.weight_one * ilosc * 100) / 100, 'kg') : undefined}
                    />
                    <Field
                      label="Łączna pow. obr."
                      value={formLog?.area_one != null ? fmt(Math.round(formLog.area_one * ilosc * 100) / 100, 'dm²') : undefined}
                    />
                  </div>
                ) : null}
              </div>

              {/* Wycena */}
              <div style={card}>
                <div style={sectionTitle}>Wycena</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                  <Field label="Handlówka kpl"  value={price?.cost_commercial_kit != null ? fmt(price.cost_commercial_kit, 'zł') : undefined} />
                  <Field label="Kwota rbh"       value={price?.cost_labor_hour     != null ? fmt(price.cost_labor_hour,     'zł') : undefined} />
                  <Field label="Cena kooperacji" value={price?.cost_cooperation    != null ? fmt(price.cost_cooperation,    'zł') : undefined} />
                  <Field label="Suma obróbki"    value={price?.cost_machining      != null ? fmt(price.cost_machining,      'zł') : undefined} />
                  <Field label="Materiał kpl"    value={formLog?.cost_kit          != null ? fmt(formLog.cost_kit,          'zł') : undefined} />
                  <Field label="Cena kpl"        value={price?.price_kit           != null ? fmt(price.price_kit,           'zł') : undefined} />
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9ca3af' }}>Cena szt.</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>
                    {price?.price_piece != null ? `${price.price_piece} zł` : <Dash />}
                  </span>
                </div>
              </div>

              {/* Dane poprodukcyjne */}
              <div style={card}>
                <div style={sectionTitle}>Dane Poprodukcyjne</div>
                <div style={{ marginBottom: 14 }}>
                  <Field label="Termin zamknięcia" value={formatDate(part?.finished_at) || undefined} />
                </div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...tblTh, textAlign: 'left' }}>Kooperacje</th>
                      <th style={{ ...tblTh, width: 90 }}>Cena [zł]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {copLogs.length === 0
                      ? <EmptyRow cols={2} />
                      : copLogs.map(cl => (
                        <tr key={cl.slot}>
                          <td style={{ ...tblTd, textAlign: 'left' }}>{copMap.get(cl.cooperation_id) ?? `Kop. ${cl.slot}`}</td>
                          <td style={tblTd}>{cl.cost != null ? `${cl.cost} zł` : <Dash />}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PartDetailPage() {
  const { numer_detalu } = useParams<{ numer_detalu: string }>()
  return <PartDetailContent numer_detalu={numer_detalu ?? ''} />
}
