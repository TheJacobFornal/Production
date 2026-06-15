import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import JsBarcode from 'jsbarcode'
import {
  partsApi, PartWithOrder,
  operationLogsApi, OperationLog,
  cooperationLogApi, CooperationLog,
  operationsApi, Operation,
  cooperationsApi, Cooperation,
} from '../services/api'

// ─── Barcode component ────────────────────────────────────────────────────────

function Barcode({ value, height = 45, fontSize = 8 }: { value: string; height?: number; fontSize?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          width: 1.4,
          height,
          displayValue: true,
          fontSize,
          margin: 3,
          background: 'transparent',
        })
      } catch { /* ignore invalid barcode values */ }
    }
  }, [value, height, fontSize])
  return <svg ref={ref} style={{ maxWidth: '100%' }} />
}

// ─── Kolejność operacji ───────────────────────────────────────────────────────

const OP_ORDER: Record<string, number> = {
  PIŁA: 1, PLOTER: 2, FKG: 3, FKO: 3, TOK: 4, TOKCNC: 5,
  FCNC: 6, FCNC_ROBO: 7, SZLIF: 8, ŚLUSARNIA: 9, SPAW: 10,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductionCardPage() {
  const { partId } = useParams<{ partId: string }>()

  const [part,        setPart]        = useState<PartWithOrder | null>(null)
  const [opLogs,      setOpLogs]      = useState<OperationLog[]>([])
  const [coopLogs,    setCoopLogs]    = useState<CooperationLog[]>([])
  const [operations,  setOperations]  = useState<Operation[]>([])
  const [cooperations,setCooperations]= useState<Cooperation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    const id = Number(partId)
    if (!id) return
    Promise.all([
      partsApi.getById(id),
      operationLogsApi.getByPartIds([id]),
      cooperationLogApi.getByPartIds([id]),
      operationsApi.getAll(),
      cooperationsApi.getAll(),
    ])
      .then(([p, ol, cl, ops, coops]) => {
        setPart(p)
        setOpLogs(ol)
        setCoopLogs(cl)
        setOperations(ops)
        setCooperations(coops)
      })
      .catch(() => setError('Błąd ładowania danych'))
      .finally(() => setLoading(false))
  }, [partId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      Ładowanie...
    </div>
  )
  if (error || !part) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#dc2626' }}>
      {error ?? 'Nie znaleziono detalu'}
    </div>
  )

  // Operacje z uzupełnionym czasem, posortowane
  const activeOps = opLogs
    .filter(ol => (ol.time_estimated ?? 0) > 0)
    .map(ol => ({ log: ol, op: operations.find(o => o.id === ol.operation_id) }))
    .filter(x => x.op)
    .sort((a, b) => {
      const orderA = OP_ORDER[a.op!.name] ?? 99
      const orderB = OP_ORDER[b.op!.name] ?? 99
      return orderA - orderB
    })

  // Kooperacje uzupełnione
  const activeCoops = coopLogs
    .sort((a, b) => a.slot - b.slot)
    .map(cl => ({ log: cl, coop: cooperations.find(c => c.id === cl.cooperation_id) }))
    .filter(x => x.coop)

  const barcodeVal = part.barcode ?? part.part_number

  return (
    <>
      {/* ── Przycisk druku (ukryty przy druku) ─────────────────────── */}
      <div className="no-print" style={{
        position: 'fixed', top: 16, right: 16, zIndex: 100,
        display: 'flex', gap: 8,
      }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 20px', background: '#1d4ed8', color: 'white',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Drukuj
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding: '8px 14px', background: '#6b7280', color: 'white',
            border: 'none', borderRadius: 6, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Karta ──────────────────────────────────────────────────── */}
      <div style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 11,
        padding: '20px 24px',
        maxWidth: 740,
        margin: '0 auto',
        color: '#111',
        background: '#fff',
      }}>

        {/* Nagłówek */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: '#111' }}>
            KARTA PRODUKCYJNA
          </div>
          <img src="/Logo_mini.png" alt="ProMate" style={{ height: 40, objectFit: 'contain' }} />
        </div>

        <hr style={{ borderTop: '2px solid #111', margin: '0 0 14px' }} />

        {/* Info + barcode */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {[
                ['Nr zlecenia:', part.order_number],
                ['Nr detalu:',   part.part_number],
                ['Nazwa:',       part.name],
                ['Ilość:',       String(part.quantity_right)],
              ].map(([label, val]) => (
                <tr key={label}>
                  <td style={{ paddingRight: 10, paddingBottom: 3, color: '#444', whiteSpace: 'nowrap' }}>{label}</td>
                  <td style={{ fontWeight: 700, paddingBottom: 3 }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'right' }}>
            <Barcode value={barcodeVal} height={55} fontSize={9} />
          </div>
        </div>

        {/* Etapy produkcji */}
        {activeOps.length > 0 && (
          <Section title="ETAPY PRODUKCJI:" badge="Skończone">
            {activeOps.map(({ op }, i) => (
              <OperationRow
                key={op!.id}
                index={i + 1}
                label={op!.name}
                barcodeVal={barcodeVal}
              />
            ))}
          </Section>
        )}

        {/* Etapy kooperacji */}
        {activeCoops.length > 0 && (
          <Section title="ETAPY KOOPERACJI:" badge="Pojechało">
            {activeCoops.map(({ coop }, i) => (
              <OperationRow
                key={coop!.id}
                index={`K${i + 1}`}
                label={coop!.name}
                barcodeVal={barcodeVal}
              />
            ))}
          </Section>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { size: A4; margin: 12mm 10mm; }
        }
      `}</style>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Nagłówek sekcji */}
      <div style={{
        background: '#d1d5db',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '5px 10px',
        fontWeight: 700, fontSize: 11, letterSpacing: 0.3,
        border: '1px solid #9ca3af',
      }}>
        <span>{title}</span>
        <span>{badge}</span>
      </div>
      {children}
    </div>
  )
}

function OperationRow({ index, label, barcodeVal }: {
  index: number | string
  label: string
  barcodeVal: string
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '38px 90px 1fr auto 80px 30px',
      alignItems: 'center',
      borderLeft: '1px solid #9ca3af',
      borderRight: '1px solid #9ca3af',
      borderBottom: '1px solid #9ca3af',
      minHeight: 64,
    }}>
      {/* Numer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700,
        borderRight: '1px solid #d1d5db',
        height: '100%',
      }}>
        {index}
      </div>

      {/* Nazwa operacji */}
      <div style={{
        display: 'flex', alignItems: 'center',
        fontSize: 13, fontWeight: 700, padding: '0 8px',
        borderRight: '1px solid #d1d5db',
        height: '100%',
      }}>
        {label}
      </div>

      {/* Barcode */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4px 6px',
        borderRight: '1px solid #d1d5db',
      }}>
        <Barcode value={barcodeVal} height={38} fontSize={7} />
      </div>

      {/* Podpis */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
        padding: '4px 10px 6px',
        borderRight: '1px solid #d1d5db',
        height: '100%',
      }}>
        <div style={{ borderBottom: '1px solid #555', width: 80, marginBottom: 2 }} />
        <span style={{ fontSize: 9, color: '#555' }}>Podpis</span>
      </div>

      {/* Data */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
        padding: '4px 6px 6px',
        borderRight: '1px solid #d1d5db',
        height: '100%',
      }}>
        <div style={{ borderBottom: '1px solid #555', width: 68, marginBottom: 2 }} />
        <span style={{ fontSize: 9, color: '#555' }}>Data</span>
      </div>

      {/* Checkbox */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%',
      }}>
        <div style={{
          width: 18, height: 18,
          border: '1.5px solid #555',
        }} />
      </div>
    </div>
  )
}
