import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  partsApi, PartWithOrder,
  operationLogsApi, OperationLog,
  operationsApi, Operation,
  formLogApi, FormLogDims,
  materialsApi, Material,
  cooperationLogApi, CooperationLog,
  cooperationsApi, Cooperation,
  commercialApi,
} from '../services/api'

const BORDER = '1px solid #000'
const TH: React.CSSProperties = { border: BORDER, padding: '2px 5px', fontWeight: 700, fontSize: 12, textAlign: 'center', verticalAlign: 'middle' }
const TD: React.CSSProperties = { border: BORDER, padding: '2px 5px', fontSize: 12, verticalAlign: 'middle' }

function fmt(d: string | null | undefined): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TOTAL_OP_ROWS = 13

export default function ProductionCardPage() {
  const { partId } = useParams<{ partId: string }>()

  const [part,         setPart]         = useState<PartWithOrder | null>(null)
  const [opLogs,       setOpLogs]       = useState<OperationLog[]>([])
  const [operations,   setOperations]   = useState<Operation[]>([])
  const [formLog,      setFormLog]      = useState<FormLogDims | null>(null)
  const [materials,    setMaterials]    = useState<Material[]>([])
  const [coopLogs,     setCoopLogs]     = useState<CooperationLog[]>([])
  const [cooperations, setCooperations] = useState<Cooperation[]>([])
  const [isHandlowka,  setIsHandlowka]  = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    const id = Number(partId)
    if (!id) return
    Promise.all([
      partsApi.getById(id),
      operationLogsApi.getByPartIds([id]),
      operationsApi.getAll(),
      formLogApi.getByPartIds([id]),
      materialsApi.getAll(),
      cooperationLogApi.getByPartIds([id]),
      cooperationsApi.getAll(),
      commercialApi.getCheckedPartIds([id]),
    ])
      .then(([p, ol, ops, fl, mats, cl, coops, commercial]) => {
        setPart(p)
        setOpLogs(ol)
        setOperations(ops)
        setFormLog(fl[0] ?? null)
        setMaterials(mats)
        setCoopLogs(cl)
        setCooperations(coops)
        setIsHandlowka((commercial as number[]).includes(id))
      })
      .catch(() => setError('Błąd ładowania danych'))
      .finally(() => setLoading(false))
  }, [partId])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial' }}>Ładowanie...</div>
  if (error || !part) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial', color: '#dc2626' }}>{error ?? 'Nie znaleziono detalu'}</div>

  // Operacje posortowane wg zaplanowanej kolejności
  const activeOps = opLogs
    .filter(ol => (ol.time_estimated ?? 0) > 0)
    .map(ol => ({ log: ol, op: operations.find(o => o.id === ol.operation_id) }))
    .filter(x => x.op)
    .sort((a, b) => (a.log.operation_order ?? 99) - (b.log.operation_order ?? 99))

  const materialName = formLog?.material_est_id
    ? (materials.find(m => m.id === formLog.material_est_id)?.name ?? '')
    : ''

  type DisplayRow =
    | { kind: 'op';    entry: { log: OperationLog; op: Operation } }
    | { kind: 'label'; name: string }
    | { kind: 'empty' }

  const coopNames = coopLogs
    .sort((a, b) => a.slot - b.slot)
    .map(cl => cooperations.find(c => c.id === cl.cooperation_id)?.name ?? '')
    .filter(Boolean)

  const opRows: DisplayRow[] = [
    { kind: 'label', name: 'PIŁA' },
    ...activeOps.map(e => ({ kind: 'op' as const, entry: e as { log: OperationLog; op: Operation } })),
    { kind: 'label', name: 'ŚLUSARNIA' },
  ]
  const allRows: DisplayRow[] = []
  opRows.forEach((row, i) => {
    allRows.push(row)
    if (i < opRows.length - 1) allRows.push({ kind: 'empty' })
  })
  if (coopNames.length > 0) {
    allRows.push({ kind: 'empty' })
    coopNames.forEach((name, i) => {
      allRows.push({ kind: 'label', name })
      if (i < coopNames.length - 1) allRows.push({ kind: 'empty' })
    })
  }
  while (allRows.length < TOTAL_OP_ROWS) allRows.push({ kind: 'empty' })

  return (
    <>
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Drukuj
        </button>
        <button onClick={() => window.close()} style={{ padding: '8px 14px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, padding: '15px', maxWidth: 960, margin: '0 auto', color: '#000', background: '#fff' }}>

        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          KARTA WYROBU DETALU
        </div>

        {/* Numer zamówienia / Termin realizacji */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '18%' }} /><col style={{ width: '52%' }} />
            <col style={{ width: '14%' }} /><col style={{ width: '16%' }} />
          </colgroup>
          <tbody>
            <tr style={{ height: 27 }}>
              <td style={TH}>Numer zamówienia</td>
              <td style={TD}>{part.order_number}</td>
              <td style={TH}>Termin realizacji</td>
              <td style={TD}>{fmt(part.deadline_at)}</td>
            </tr>
          </tbody>
        </table>

        {/* Przygotówka */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: -1 }}>
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '50%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={3} style={{ ...TH, paddingTop: 5, paddingBottom: 5 }}>Przygotówka</td>
            </tr>
            <tr>
              <td style={TH}>Gatunek materiału</td>
              <td style={TH}>Handlówka</td>
              <td style={TH}>Data</td>
            </tr>
            <tr style={{ height: 30 }}>
              <td style={TD}>{materialName}</td>
              <td style={{ ...TD, textAlign: 'center', fontWeight: isHandlowka ? 700 : 400 }}>{isHandlowka ? 'TAK' : 'NIE'}</td>
              <td style={TD}></td>
            </tr>
          </tbody>
        </table>

        {/* Obróbka + Kontrola jakości */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: -1 }}>
          <colgroup>
            <col style={{ width: '15%' }} /><col style={{ width: '26%' }} /><col style={{ width: '19%' }} />
            <col style={{ width: '8%' }} /><col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} /><col style={{ width: '16%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={7} style={{ ...TH, paddingTop: 2, paddingBottom: 2 }}>Obróbka</td>
            </tr>
            <tr>
              <td style={TH}>Operacja</td>
              <td style={TH}>Uwagi</td>
              <td style={TH}>Data</td>
              <td style={TH}>Ilość</td>
              <td style={TH}>Czas</td>
              <td style={TH}>Kontrola</td>
              <td style={TH}>Podpis</td>
            </tr>
            {allRows.map((row, i) => (
              <tr key={i}>
                {/* Operacja */}
                <td style={{ ...TD, height: 26, fontWeight: row.kind !== 'empty' ? 700 : 400, padding: row.kind === 'empty' ? 0 : '2px 5px' }}>
                  {row.kind === 'op'    ? row.entry.op.name
                  : row.kind === 'label' ? row.name
                  : <InputCell />}
                </td>
                {/* Uwagi */}
                <td style={{ ...TD, height: 26, padding: 0 }}>
                  <NotesCell
                    initialValue={row.kind === 'op' ? (row.entry.log.notes ?? '') : ''}
                    onSave={row.kind === 'op'
                      ? val => operationLogsApi.saveNotes(row.entry.log.part_id, row.entry.log.operation_id, val || null).catch(console.error)
                      : () => {}}
                  />
                </td>
                {/* Data */}
                <td style={{ ...TD, height: 26, padding: 0 }}><InputCell /></td>
                {/* Ilość */}
                <td style={{ ...TD, height: 26, textAlign: 'center', padding: row.kind === 'empty' ? 0 : '2px 5px' }}>
                  {row.kind !== 'empty' ? part.quantity_right : <InputCell center />}
                </td>
                {/* Czas */}
                <td style={{ ...TD, height: 26, padding: 0 }}><InputCell /></td>
                {/* Kontrola */}
                <td style={{ ...TD, height: 26, textAlign: 'center' }}><Checkbox /></td>
                {/* Podpis */}
                <td style={{ ...TD, height: 26, padding: 0 }}><InputCell /></td>
              </tr>
            ))}
            <tr>
              <td colSpan={7} style={{ ...TH, paddingTop: 2, paddingBottom: 2 }}>Kontrola jakości</td>
            </tr>
            <tr style={{ height: 21 }}>
              <td colSpan={2} style={TH}>Podpis</td>
              <td colSpan={2} style={TH}>Data</td>
              <td style={TH}>OK</td>
              <td colSpan={2} style={TH}>NOK</td>
            </tr>
            <tr style={{ height: 29 }}>
              <td colSpan={2} style={TD}></td>
              <td colSpan={2} style={TD}></td>
              <td style={{ ...TD, textAlign: 'center' }}><Checkbox /></td>
              <td colSpan={2} style={{ ...TD, textAlign: 'center' }}><Checkbox /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { size: A4 portrait; margin: 15px; }
          tr { height: 26px !important; }
          input, textarea { display: block; min-height: 18px; box-sizing: border-box; }
        }
      `}</style>
    </>
  )
}

function Checkbox() {
  return (
    <div style={{
      width: 15, height: 15, border: '1.5px solid #000',
      display: 'inline-block', verticalAlign: 'middle',
    }} />
  )
}

function InputCell({ center }: { center?: boolean }) {
  const [val, setVal] = useState('')
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box',
        border: 'none', outline: 'none',
        background: 'transparent', fontSize: 12,
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '2px 5px',
        textAlign: center ? 'center' : 'left',
      }}
    />
  )
}

function NotesCell({ initialValue, onSave }: { initialValue: string; onSave: (val: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <textarea
      ref={ref}
      defaultValue={initialValue}
      rows={1}
      onBlur={e => onSave(e.target.value)}
      onInput={e => {
        const el = e.currentTarget
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      }}
      style={{
        width: '100%', boxSizing: 'border-box',
        border: 'none', outline: 'none', resize: 'none',
        fontSize: 12, fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '2px 5px', background: 'transparent',
        minHeight: 26, overflow: 'hidden',
      }}
    />
  )
}
