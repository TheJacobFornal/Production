import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ordersApi, formLogApi, operationLogsApi, cooperationLogApi,
  priceApi, materialsApi, cooperationsApi, operationsApi, partsApi, dialogApi,
} from '../services/api'
import type { Part } from '../types'
import type {
  FormLogDims, OperationLog, CooperationLog, PartPaths,
  Price, Material, Cooperation, Operation,
} from '../services/api'

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
const BG_PAGE = '#f0f4f8'
const BLUE    = '#1d4ed8'
const TH_BG   = '#dbeafe'
const TH_TEXT = '#1e40af'

const sectionTitle: React.CSSProperties = {
  color: '#1e293b', fontWeight: 700, fontSize: 14,
  marginBottom: 10, marginTop: 0,
}
const fieldLabel: React.CSSProperties = {
  color: '#64748b', fontWeight: 600, fontSize: 13,
  minWidth: 148, display: 'inline-block', flexShrink: 0,
}
const fieldValue: React.CSSProperties = { color: '#1e293b', fontSize: 13 }
const card: React.CSSProperties = {
  background: '#fff', border: BORDER, borderRadius: 8,
  padding: '14px 18px', marginBottom: 14,
}
const tblTh: React.CSSProperties = {
  background: TH_BG, color: TH_TEXT, fontWeight: 700, fontSize: 11,
  padding: '5px 10px', border: BORDER, textAlign: 'center', whiteSpace: 'nowrap',
}
const tblTd: React.CSSProperties = {
  padding: '4px 8px', fontSize: 12,
  border: '1px solid #e2e8f0', textAlign: 'center', color: '#1e293b',
}
const infoBox: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 6,
  padding: '10px 14px', background: '#fafafa',
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
    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 7 }}>
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

export function PartDetailContent({ numer_detalu: rawNum, part_id: propPartId, onClose, onOperationTimeUpdated }: {
  numer_detalu?: string
  part_id?: number
  onClose?: () => void
  onOperationTimeUpdated?: (partId: number, operationId: number, timeEstimated: number | null) => void
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
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [editingOp, setEditingOp] = useState<{ operationId: number; value: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [summaries, mats, cps, operations] = await Promise.all([
          ordersApi.getSummaryList(),
          materialsApi.getAll(),
          cooperationsApi.getAll(),
          operationsApi.getAll(),
        ])
        if (cancelled) return
        setMaterials(mats)
        setCoops(cps)
        setOps(operations)

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

  return (
    <div style={{ background: BG_PAGE, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 28px', background: '#fff', borderBottom: BORDER, flexShrink: 0,
      }}>
        <button
          onClick={() => onClose ? onClose() : navigate(-1)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: BLUE, fontSize: 13, fontWeight: 600, padding: '4px 0' }}
        >
          {onClose ? '✕ Zamknij' : '← Wróć'}
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', margin: 0 }}>Karta Detalu</h1>
        <img src="/Logo.png" alt="ProMate" style={{ height: 32, objectFit: 'contain' }} />
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 36px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px', alignItems: 'start', maxWidth: 1100, margin: '0 auto' }}>

            {/* ═══ LEWA KOLUMNA ═══ */}
            <div>

              {/* Informacje podstawowe */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ ...sectionTitle, marginBottom: 0 }}>Informacje podstawowe</span>
                  {part?.symbol && (
                    <span style={{ padding: '2px 10px', borderRadius: 4, background: '#eff6ff', border: '1px solid #93c5fd', color: BLUE, fontSize: 12, fontWeight: 600 }}>
                      {part.symbol}
                    </span>
                  )}
                </div>
                <Field label="Nr Detalu:"        value={part?.part_number} />
                <Field label="Nazwa Detalu:"     value={part?.name} />
                <Field label="Nr Zlecenia:"      value={info?.orderNumber} />
                <Field label="Termin wykonania:" value={formatDate(info?.deadlineAt) || undefined} />
                <Field label="Ilość:"            value={ilosc ?? undefined} />
                <div style={{ height: 6 }} />
                <Field label="Status:" value={part?.phase_name ? (PHASE_LABELS[part.phase_name] ?? part.phase_name) : undefined} />
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 7 }}>
                  <span style={fieldLabel}>Karta wydrukowana:</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: part?.card_printed ? '#16a34a' : '#dc2626' }}>
                    {part?.card_printed ? '✓ Tak' : '✗ Nie'}
                  </span>
                </div>
              </div>

              {/* Planowane operacje */}
              <div style={card}>
                <div style={sectionTitle}>Planowane operacje:</div>
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
              {(() => {
                const fileTypes: { key: 'PDF_path' | 'DWG_path' | 'STP_path'; label: string; ext: '.pdf' | '.dwg' | '.stp' }[] = [
                  { key: 'PDF_path', label: 'PDF', ext: '.pdf' },
                  { key: 'DWG_path', label: 'DWG', ext: '.dwg' },
                  { key: 'STP_path', label: 'STP', ext: '.stp' },
                ]
                const anyPath = paths?.PDF_path || paths?.DWG_path || paths?.STP_path
                const folderPath = anyPath ? anyPath.replace(/[/\\][^/\\]+$/, '') : null

                const pickFile = async (key: 'PDF_path' | 'DWG_path' | 'STP_path', ext: '.pdf' | '.dwg' | '.stp') => {
                  if (!part) return
                  const res = await dialogApi.selectFile(ext, folderPath)
                  if (!res.path) return
                  await partsApi.updatePaths(part.id, { [key]: res.path })
                  const updated = await partsApi.getPaths([part.id])
                  setPaths(updated[0] ?? null)
                }

                return (
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={sectionTitle}>Pliki:</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {part && (
                          <button
                            onClick={() => window.open(`/api/parts/${part.id}/card-pdf`, '_blank')}
                            style={{
                              padding: '3px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                              background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontWeight: 600,
                            }}
                          >
                            📄 Otwórz kartę
                          </button>
                        )}
                        {folderPath && (
                          <button
                            onClick={() => dialogApi.openFolder(folderPath)}
                            style={{
                              padding: '3px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                              background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: 600,
                            }}
                          >
                            📁 Otwórz folder
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fileTypes.map(({ key, label, ext }) => {
                        const filePath = paths?.[key] ?? null
                        const fileName = filePath ? filePath.replace(/.*[/\\]/, '') : null
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16, lineHeight: 1, color: filePath ? '#16a34a' : '#dc2626' }}>
                              {filePath ? '✓' : '✗'}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 13, minWidth: 36, color: '#374151' }}>{label}</span>
                            <span style={{
                              flex: 1, fontSize: 11, color: '#6b7280',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }} title={filePath ?? ''}>
                              {fileName ?? '—'}
                            </span>
                            <button
                              onClick={() => pickFile(key, ext)}
                              style={{
                                padding: '2px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                                background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db',
                                flexShrink: 0,
                              }}
                            >
                              {filePath ? 'Zmień' : 'Dodaj'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ═══ PRAWA KOLUMNA ═══ */}
            <div>

              {/* Formatka */}
              <div style={card}>
                <div style={sectionTitle}>Formatka:</div>
                <div style={infoBox}>
                  <Field label="Wymiary:"        value={dimStr || undefined} />
                  <Field label="Materiał:"       value={matName || undefined} />
                  <Field label="Masa szt.:"      value={formLog?.weight_one != null ? fmt(formLog.weight_one, 'kg') : undefined} />
                  <Field label="Pow. obr. szt.:" value={formLog?.area_one   != null ? fmt(formLog.area_one,   'dm²') : undefined} />
                  <div style={{ height: 8 }} />
                  <Field
                    label="Łączna masa:"
                    value={formLog?.weight_one != null && ilosc ? fmt(Math.round(formLog.weight_one * ilosc * 100) / 100, 'kg') : undefined}
                  />
                  <Field
                    label="Łączna pow. obr.:"
                    value={formLog?.area_one != null && ilosc ? fmt(Math.round(formLog.area_one * ilosc * 100) / 100, 'dm²') : undefined}
                  />
                </div>
              </div>

              {/* Wycena */}
              <div style={card}>
                <div style={sectionTitle}>Wycena:</div>
                <div style={infoBox}>
                  <Field label="Handlówka kpl:"   value={price?.cost_commercial_kit != null ? fmt(price.cost_commercial_kit, 'zł') : undefined} />
                  <Field label="Kwota rbh:"        value={price?.cost_labor_hour     != null ? fmt(price.cost_labor_hour,     'zł') : undefined} />
                  <Field label="Cena kooperacji:"  value={price?.cost_cooperation    != null ? fmt(price.cost_cooperation,    'zł') : undefined} />
                  <Field label="Suma obróbki:"     value={price?.cost_machining      != null ? fmt(price.cost_machining,      'zł') : undefined} />
                  <Field label="Materiał kpl:"     value={formLog?.cost_kit          != null ? fmt(formLog.cost_kit,          'zł') : undefined} />
                  <Field label="Cena kpl:"         value={price?.price_kit           != null ? fmt(price.price_kit,           'zł') : undefined} />

                  {/* Cena szt. — wyróżniona */}
                  <div style={{ paddingTop: 10, marginTop: 6, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ color: BLUE, fontWeight: 800, fontSize: 17 }}>Cena szt.:</span>
                    <span style={{ fontSize: 17, fontWeight: 700, color: BLUE }}>
                      {price?.price_piece != null ? `${price.price_piece} zł` : <Dash />}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dane poprodukcyjne */}
              <div style={card}>
                <div style={sectionTitle}>Dane Poprodukcyjne:</div>

                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ ...fieldLabel, fontSize: 12 }}>Termin zamknięcia:</span>
                  <span style={{ ...fieldValue, fontWeight: 600 }}>
                    {formatDate(part?.finished_at) || <Dash />}
                  </span>
                </div>

                {/* Kooperacje / Cena */}
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...tblTh, textAlign: 'left', width: 130 }}>Kooperacje</th>
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
