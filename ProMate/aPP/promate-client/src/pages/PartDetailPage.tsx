import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ordersApi, formLogApi, operationLogsApi, cooperationLogApi,
  priceApi, materialsApi, cooperationsApi, operationsApi, partsApi,
} from '../services/api'
import type { Part } from '../types'
import type {
  FormLogDims, OperationLog, CooperationLog,
  Price, Material, Cooperation, Operation,
} from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartInfo {
  part:        Part
  orderNumber: string
  deadlineAt:  string | null
}

// ─── Mapping operacji ─────────────────────────────────────────────────────────

const OP_ID_TO_LABEL: Record<number, string> = {
  1: 'PLOTER', 2: 'FKG', 3: 'FKO', 4: 'TOK', 5: 'TOKCNC',
  6: 'FCNC', 7: 'FCNC ROBO', 8: 'PIŁA', 9: 'ŚLUSARNIA', 10: 'SZLIF', 11: 'SPAW',
}

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

export function PartDetailContent({ numer_detalu: rawNum, part_id: propPartId, onClose }: {
  numer_detalu?: string
  part_id?: number
  onClose?: () => void
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
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

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
        const [fls, oLogs, cLogs, prices] = await Promise.all([
          formLogApi.getByPartIds([partId]),
          operationLogsApi.getByPartIds([partId]),
          cooperationLogApi.getByPartIds([partId]),
          priceApi.getByPartIds([partId]),
        ])
        if (cancelled) return
        setFormLog(fls[0] ?? null)
        setOpLogs(oLogs)
        setCopLogs(cLogs)
        setPrice(prices[0] ?? null)
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
                <Field label="Status:"      value={part?.phase_id != null ? `Faza ${part.phase_id}` : undefined} />
                <Field label="Lokalizacja:" value={part?.location_id != null ? `Regał ${part.location_id}` : undefined} />
              </div>

              {/* Planowane operacje */}
              <div style={card}>
                <div style={sectionTitle}>Planowane operacje:</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...tblTh, textAlign: 'left', minWidth: 120 }}>Operacja</th>
                        <th style={{ ...tblTh, width: 80 }}>Czas [min]</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opLogsWithTime.length === 0
                        ? <EmptyRow cols={2} />
                        : opLogsWithTime.map(l => (
                          <tr key={l.id}>
                            <td style={{ ...tblTd, textAlign: 'left' }}>
                              {ops.find(o => o.id === l.operation_id)?.name ?? OP_ID_TO_LABEL[l.operation_id] ?? `Op. ${l.operation_id}`}
                            </td>
                            <td style={tblTd}>{l.time_real}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
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

              {/* Kooperacje (wyjazd / przyjazd) */}
              <div style={card}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...tblTh, textAlign: 'left', width: 130 }}>Kooperacje:</th>
                      <th style={tblTh}>Wyjazd:</th>
                      <th style={tblTh}>Przyjazd:</th>
                    </tr>
                  </thead>
                  <tbody>
                    {copLogs.length === 0
                      ? <EmptyRow cols={3} />
                      : copLogs.map(cl => (
                        <tr key={cl.slot}>
                          <td style={{ ...tblTd, textAlign: 'left' }}>{copMap.get(cl.cooperation_id) ?? `Kop. ${cl.slot}`}</td>
                          <td style={tblTd}><Dash /></td>
                          <td style={tblTd}><Dash /></td>
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
