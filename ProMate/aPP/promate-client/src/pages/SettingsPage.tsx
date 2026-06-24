import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { materialsApi, cooperationsApi, Material, Cooperation, printersApi, usersApi, authApi, appSettingsApi, UserRow, PositionRow } from '../services/api'
import { useAuth } from '../context/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'ogolne' | 'konto' | 'dane' | 'pracownicy'

// ─── Settings helpers (localStorage) ─────────────────────────────────────────

interface AppSettings {
  printer:    string
  printKarta: boolean
}

const SETTINGS_KEY = 'promate_settings'

export function loadSettings(): AppSettings {
  try { return { printer: '', printKarta: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } }
  catch { return { printer: '', printKarta: true } }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// ─── Shared styles (matching HandlowkaPage / OrderDetailPage) ─────────────────

const FILTER_INPUT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #93c5fd', borderRadius: 3,
  padding: '3px 7px', fontSize: 12, outline: 'none',
  background: '#f0f9ff', color: '#1e40af',
}

const TH_STYLE: React.CSSProperties = {
  padding: '8px 10px', fontSize: 12, fontWeight: 700,
  color: '#1e40af', background: '#dbeafe',
  borderRight: '1px solid #bfdbfe',
  borderBottom: '1px solid #93c5fd',
  whiteSpace: 'nowrap', userSelect: 'none',
}

const CELL: React.CSSProperties = {
  borderRight: '1px solid #d1d5db',
  borderBottom: '1px solid #e5e7eb',
}

// ─── Input cell ───────────────────────────────────────────────────────────────

function ICell({ value, onChange, align = 'left', placeholder = '—', type = 'text', onFocusRow, onBlurRow }: {
  value: string
  onChange: (v: string) => void
  align?: 'left' | 'right' | 'center'
  placeholder?: string
  type?: 'text' | 'number'
  onFocusRow?: () => void
  onBlurRow?: () => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  return (
    <td style={{ ...CELL, padding: 0, height: 34 }}>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => { e.currentTarget.style.outline = 'none'; onChange(draft); onBlurRow?.() }}
        onKeyDown={e => {
          if (e.key === 'Enter') onChange(draft)
          if (type === 'number' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) e.preventDefault()
        }}
        style={{
          width: '100%', height: '100%', boxSizing: 'border-box',
          border: 'none', borderRadius: 0,
          padding: '0 10px', fontSize: 13,
          background: 'transparent', color: '#111827',
          outline: 'none', textAlign: align,
        }}
        onFocus={e => { e.currentTarget.style.outline = '2px solid #3b82f6'; e.currentTarget.style.outlineOffset = '-2px'; onFocusRow?.() }}
      />
    </td>
  )
}

// ─── Filter icon ─────────────────────────────────────────────────────────────

function FilterIcon({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '1px 4px', borderRadius: 3, cursor: 'pointer', fontSize: 10, marginLeft: 6,
        background: active ? '#2563eb' : 'transparent',
        color:      active ? '#fff'    : '#93c5fd',
      }}
    >▽</span>
  )
}

// ─── Materiały ────────────────────────────────────────────────────────────────

function MaterialsTable() {
  const [rows,      setRows]      = useState<Material[]>([])
  const [saving,    setSaving]    = useState<Set<number | 'new'>>(new Set())
  const [newRow,    setNewRow]    = useState<{ name: string; density: string; cost: string }>({ name: '', density: '', cost: '' })
  const [showFilter, setShowFilter] = useState(false)
  const [fName,      setFName]      = useState('')
  const [focusedId,  setFocusedId]  = useState<number | null>(null)

  useEffect(() => { materialsApi.getAll().then(setRows) }, [])

  const isComplete = (r: Material) => !!r.name && r.density != null && r.cost != null

  const updateRow = async (row: Material) => {
    setSaving(p => new Set(p).add(row.id))
    await materialsApi.upsert(row.id, { name: row.name, density: row.density, cost: row.cost }).catch(console.error)
    setSaving(p => { const s = new Set(p); s.delete(row.id); return s })
  }

  const setField = (id: number, field: keyof Material, raw: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, [field]: field === 'name' ? raw : (raw === '' ? null : Number(raw)) }
      updateRow(updated)
      return updated
    }))
  }

  const saveNew = async () => {
    if (!newRow.name.trim()) return
    setSaving(p => new Set(p).add('new'))
    try {
      const { id } = await materialsApi.upsert(null, {
        name:    newRow.name,
        density: newRow.density ? Number(newRow.density) : null,
        cost:    newRow.cost    ? Number(newRow.cost)    : null,
      })
      setRows(prev => [...prev, { id, name: newRow.name, density: newRow.density ? Number(newRow.density) : null, cost: newRow.cost ? Number(newRow.cost) : null, unit: null }])
      setNewRow({ name: '', density: '', cost: '' })
    } catch (e) { console.error(e) }
    setSaving(p => { const s = new Set(p); s.delete('new'); return s })
  }

  const displayed = [...rows]
    .sort((a, b) => Number(isComplete(b)) - Number(isComplete(a)))
    .filter(r => r.name.toLowerCase().includes(fName.toLowerCase()))

  return (
    <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
      <div style={{ padding: '9px 14px', background: '#dbeafe', borderBottom: '1px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Materiały</span>
        {saving.size > 0 && <span style={{ fontSize: 11, color: '#60a5fa' }}>Zapisywanie...</span>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <colgroup>
          <col style={{ width: '44%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...TH_STYLE, textAlign: 'left' }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                Nazwa
                <FilterIcon active={!!fName} onClick={() => setShowFilter(v => !v)} />
              </span>
            </th>
            <th style={{ ...TH_STYLE, textAlign: 'right' }}>Gęstość [g/cm³]</th>
            <th style={{ ...TH_STYLE, textAlign: 'right', borderRight: 'none' }}>Koszt [zł/kg]</th>
          </tr>
          {showFilter && (
            <tr style={{ background: '#f0f9ff' }}>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>
                <input style={FILTER_INPUT} placeholder="Szukaj..." value={fName}
                  onChange={e => setFName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setShowFilter(false) }} />
              </td>
              <td style={{ borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }} />
              <td style={{ borderBottom: '1px solid #d1d5db' }} />
            </tr>
          )}
        </thead>
        <tbody>
          {displayed.map(row => {
            const complete  = isComplete(row)
            const isFocused = focusedId === row.id
            const bg        = isFocused ? '#dbeafe' : complete ? '#fff' : '#f3f4f6'
            return (
              <tr key={row.id} style={{ background: bg }}>
                <ICell value={row.name}                                            onChange={v => setField(row.id, 'name',    v)} onFocusRow={() => setFocusedId(row.id)} onBlurRow={() => setFocusedId(null)} />
                <ICell value={row.density != null ? String(row.density) : ''} onChange={v => setField(row.id, 'density', v)} align="right" type="number" onFocusRow={() => setFocusedId(row.id)} onBlurRow={() => setFocusedId(null)} />
                <ICell value={row.cost    != null ? String(row.cost)    : ''} onChange={v => setField(row.id, 'cost',    v)} align="right" type="number" onFocusRow={() => setFocusedId(row.id)} onBlurRow={() => setFocusedId(null)} />
              </tr>
            )
          })}
          <tr style={{ background: '#f8fafc' }}>
            <td style={{ ...CELL, padding: '0 10px', height: 34, borderTop: '2px solid #e2e8f0' }}>
              <input value={newRow.name} onChange={e => setNewRow(p => ({ ...p, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveNew() }}
                placeholder="+ Dodaj materiał"
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#6b7280' }} />
            </td>
            <td style={{ ...CELL, padding: '0 10px', height: 34, borderTop: '2px solid #e2e8f0' }}>
              <input type="number" value={newRow.density} onChange={e => setNewRow(p => ({ ...p, density: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveNew() }}
                placeholder="—"
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#6b7280', textAlign: 'right' }} />
            </td>
            <td style={{ padding: '0 10px', height: 34, borderTop: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" value={newRow.cost} onChange={e => setNewRow(p => ({ ...p, cost: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveNew() }}
                placeholder="—"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#6b7280', textAlign: 'right' }} />
              {newRow.name && (
                <button onClick={saveNew} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Zapisz</button>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Kooperacje ───────────────────────────────────────────────────────────────

function CooperationsTable() {
  const [rows,      setRows]      = useState<Cooperation[]>([])
  const [saving,    setSaving]    = useState<Set<number | 'new'>>(new Set())
  const [newRow,    setNewRow]    = useState<{ name: string; price: string; unit: string }>({ name: '', price: '', unit: '' })
  const [showFilter, setShowFilter] = useState(false)
  const [fName,      setFName]      = useState('')
  const [focusedId,  setFocusedId]  = useState<number | null>(null)

  useEffect(() => { cooperationsApi.getAll().then(setRows) }, [])

  const isComplete = (r: Cooperation) => !!r.name && r.price != null && !!r.unit

  const updateRow = async (row: Cooperation) => {
    setSaving(p => new Set(p).add(row.id))
    await cooperationsApi.upsert(row.id, { name: row.name, price: row.price, unit: row.unit }).catch(console.error)
    setSaving(p => { const s = new Set(p); s.delete(row.id); return s })
  }

  const setField = (id: number, field: keyof Cooperation, raw: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, [field]: (field === 'name' || field === 'unit') ? raw : (raw === '' ? null : Number(raw)) }
      updateRow(updated)
      return updated
    }))
  }

  const saveNew = async () => {
    if (!newRow.name.trim()) return
    setSaving(p => new Set(p).add('new'))
    try {
      const { id } = await cooperationsApi.upsert(null, {
        name:  newRow.name,
        price: newRow.price ? Number(newRow.price) : null,
        unit:  newRow.unit  || null,
      })
      setRows(prev => [...prev, { id, name: newRow.name, price: newRow.price ? Number(newRow.price) : null, unit: newRow.unit || null }])
      setNewRow({ name: '', price: '', unit: '' })
    } catch (e) { console.error(e) }
    setSaving(p => { const s = new Set(p); s.delete('new'); return s })
  }

  const displayed = [...rows]
    .sort((a, b) => Number(isComplete(b)) - Number(isComplete(a)))
    .filter(r => r.name.toLowerCase().includes(fName.toLowerCase()))

  return (
    <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
      <div style={{ padding: '9px 14px', background: '#dbeafe', borderBottom: '1px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Kooperacje</span>
        {saving.size > 0 && <span style={{ fontSize: 11, color: '#60a5fa' }}>Zapisywanie...</span>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <colgroup>
          <col style={{ width: '44%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...TH_STYLE, textAlign: 'left' }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                Nazwa
                <FilterIcon active={!!fName} onClick={() => setShowFilter(v => !v)} />
              </span>
            </th>
            <th style={{ ...TH_STYLE, textAlign: 'right' }}>Cena [zł]</th>
            <th style={{ ...TH_STYLE, textAlign: 'left', borderRight: 'none' }}>Jednostka</th>
          </tr>
          {showFilter && (
            <tr style={{ background: '#f0f9ff' }}>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }}>
                <input style={FILTER_INPUT} placeholder="Szukaj..." value={fName}
                  onChange={e => setFName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setShowFilter(false) }} />
              </td>
              <td style={{ borderRight: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db' }} />
              <td style={{ borderBottom: '1px solid #d1d5db' }} />
            </tr>
          )}
        </thead>
        <tbody>
          {displayed.map(row => {
            const complete  = isComplete(row)
            const isFocused = focusedId === row.id
            const bg        = isFocused ? '#dbeafe' : complete ? '#fff' : '#f3f4f6'
            return (
              <tr key={row.id} style={{ background: bg }}>
                <ICell value={row.name}                                           onChange={v => setField(row.id, 'name',  v)} onFocusRow={() => setFocusedId(row.id)} onBlurRow={() => setFocusedId(null)} />
                <ICell value={row.price != null ? String(row.price) : ''} onChange={v => setField(row.id, 'price', v)} align="right" type="number" onFocusRow={() => setFocusedId(row.id)} onBlurRow={() => setFocusedId(null)} />
                <td style={{ ...CELL, padding: 0, height: 34 }}>
                  <select
                    value={row.unit ?? ''}
                    onChange={e => setField(row.id, 'unit', e.target.value)}
                    style={{
                      width: '100%', height: '100%', boxSizing: 'border-box',
                      border: 'none', borderRadius: 0,
                      padding: '0 10px', fontSize: 13,
                      background: 'transparent', color: row.unit ? '#111827' : '#9ca3af',
                      outline: 'none', cursor: 'pointer',
                    }}
                    onFocus={e => { setFocusedId(row.id); e.currentTarget.style.outline = '2px solid #3b82f6'; e.currentTarget.style.outlineOffset = '-2px' }}
                    onBlur={e  => { setFocusedId(null);   e.currentTarget.style.outline = 'none' }}
                  >
                    <option value="">—</option>
                    <option value="szt">szt</option>
                    <option value="mb">mb</option>
                    <option value="m2">m2</option>
                  </select>
                </td>
              </tr>
            )
          })}
          <tr style={{ background: '#f8fafc' }}>
            <td style={{ ...CELL, padding: '0 10px', height: 34, borderTop: '2px solid #e2e8f0' }}>
              <input value={newRow.name} onChange={e => setNewRow(p => ({ ...p, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveNew() }}
                placeholder="+ Dodaj kooperację"
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#6b7280' }} />
            </td>
            <td style={{ ...CELL, padding: '0 10px', height: 34, borderTop: '2px solid #e2e8f0' }}>
              <input type="number" value={newRow.price} onChange={e => setNewRow(p => ({ ...p, price: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveNew() }}
                placeholder="—"
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#6b7280', textAlign: 'right' }} />
            </td>
            <td style={{ padding: '0 10px', height: 34, borderTop: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={newRow.unit}
                onChange={e => setNewRow(p => ({ ...p, unit: e.target.value }))}
                style={{
                  flex: 1, border: 'none',
                  padding: '0 4px', fontSize: 13,
                  background: 'transparent', color: newRow.unit ? '#111827' : '#9ca3af',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">—</option>
                <option value="szt">szt</option>
                <option value="mb">mb</option>
                <option value="m2">m2</option>
              </select>
              {newRow.name && (
                <button onClick={saveNew} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Zapisz</button>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab: Ogólne ──────────────────────────────────────────────────────────────

function TabOgolne() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [printers, setPrinters] = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)

  // Ładuj globalne ustawienia z bazy
  useEffect(() => {
    appSettingsApi.get()
      .then(s => {
        const merged: AppSettings = { printer: s.printer ?? '', printKarta: s.print_karta }
        setSettings(merged)
        saveSettings(merged)
      })
      .catch(() => { /* zostają ustawienia z localStorage */ })
  }, [])

  useEffect(() => {
    printersApi.getAll()
      .then(setPrinters)
      .catch(() => setPrinters([]))
      .finally(() => setLoading(false))
  }, [])

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    appSettingsApi.save({ printer: next.printer || null, print_karta: next.printKarta })
      .catch(console.error)
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
    gap: 16,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 13, color: '#374151', width: 200, flexShrink: 0,
  }

  return (
    <div style={{ maxWidth: 540 }}>
      <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: '#dbeafe', borderBottom: '1px solid #93c5fd' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Drukowanie
          </span>
        </div>

        {/* Drukarka */}
        <div style={rowStyle}>
          <span style={labelStyle}>Drukarka</span>
          <select
            value={settings.printer}
            onChange={e => update({ printer: e.target.value })}
            style={{
              flex: 1, padding: '6px 10px', fontSize: 13,
              border: '1px solid #d1d5db', borderRadius: 6,
              background: '#fff', color: '#111827',
              outline: 'none', cursor: 'pointer',
            }}
            onFocus={e  => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px #bfdbfe' }}
            onBlur={e   => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <option value="">{loading ? 'Ładowanie...' : '— wybierz drukarkę —'}</option>
            {printers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Checkbox karta detalu */}
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Drukuj kartę wyrobu detalu</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.printKarta}
              onChange={e => update({ printKarta: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: settings.printKarta ? '#1e40af' : '#6b7280' }}>
              {settings.printKarta ? 'Tak' : 'Nie'}
            </span>
          </label>
        </div>
      </div>

      {settings.printer && (
        <div style={{ marginTop: 12, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, fontSize: 12, color: '#166534' }}>
          ✓ Aktywna drukarka: <strong>{settings.printer}</strong>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Konto ───────────────────────────────────────────────────────────────

function TabKonto() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const fullName = user ? `${user.surname} ${user.name}` : '—'
  const initials = user ? `${user.surname[0] ?? ''}${user.name[0] ?? ''}`.toUpperCase() : '??'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e5e7eb' }}>
      <span style={{ fontSize: 13, color: '#6b7280', width: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{value}</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: 1,
        }}>{initials}</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{fullName}</div>
          {user?.position_name && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{user.position_name}</div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '9px 14px', background: '#dbeafe', borderBottom: '1px solid #93c5fd' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Informacje</span>
        </div>
        <div style={{ padding: '4px 16px 8px' }}>
          <Row label="Imię i nazwisko"  value={fullName} />
          {user?.position_name && <Row label="Rola" value={user.position_name} />}
          {user?.email         && <Row label="E-mail" value={user.email} />}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '9px 14px', background: '#dbeafe', borderBottom: '1px solid #93c5fd' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', letterSpacing: '0.07em', textTransform: 'uppercase' }}>System</span>
        </div>
        <div style={{ padding: '4px 16px 8px' }}>
          <Row label="Wersja aplikacji" value="ProMate 1.0" />
          <Row label="Środowisko"       value="Produkcja" />
        </div>
      </div>

      <button
        onClick={handleLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 8,
          background: '#fff', border: '1px solid #fca5a5',
          color: '#dc2626', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Wyloguj się
      </button>
    </div>
  )
}

// ─── Pracownicy ───────────────────────────────────────────────────────────────

function TabPracownicy() {
  const [users,       setUsers]       = useState<UserRow[]>([])
  const [positions,   setPositions]   = useState<PositionRow[]>([])
  const [saving,      setSaving]      = useState<Set<number | 'new'>>(new Set())
  const [newRow,      setNewRow]      = useState({ name: '', surname: '', email: '', position_id: '' })
  const [error,       setError]       = useState('')
  const [resetLinks,  setResetLinks]  = useState<Record<number, string | null>>({})

  useEffect(() => {
    usersApi.getAll().then(setUsers).catch(() => setError('Brak tabeli użytkowników — uruchom migrate-users.sql'))
    usersApi.getPositions().then(setPositions).catch(() => {})
  }, [])

  const loginOf = (u: UserRow) => u.login || (u.surname + u.name[0])

  const markSaving = (id: number | 'new', on: boolean) =>
    setSaving(p => { const s = new Set(p); on ? s.add(id) : s.delete(id); return s })

  const updateField = async (id: number, field: keyof UserRow, raw: string | boolean) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: raw } : u))
    markSaving(id, true)
    try {
      await usersApi.update(id, { [field]: raw })
    } catch { /* ignore */ }
    markSaving(id, false)
  }

  const toggleActive = async (u: UserRow) => {
    const next = !u.is_active
    setUsers(prev => prev.map(r => r.id === u.id ? { ...r, is_active: next } : r))
    markSaving(u.id, true)
    try { await usersApi.update(u.id, { is_active: next }) } catch { /* ignore */ }
    markSaving(u.id, false)
  }

  const generateReset = async (u: UserRow) => {
    setResetLinks(p => ({ ...p, [u.id]: 'loading' }))
    try {
      const { url } = await authApi.requestReset(u.id)
      setResetLinks(p => ({ ...p, [u.id]: url }))
    } catch {
      setError(`Błąd generowania linku dla ${u.surname} ${u.name}`)
      setResetLinks(p => ({ ...p, [u.id]: null }))
    }
  }

  const copyLink = (u: UserRow) => {
    const url = resetLinks[u.id]
    if (!url || url === 'loading') return
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => copyFallback(url))
    } else {
      copyFallback(url)
    }
    setResetLinks(p => ({ ...p, [u.id]: '__copied__' }))
    setTimeout(() => setResetLinks(p => ({ ...p, [u.id]: url })), 2000)
  }

  const copyFallback = (text: string) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  const saveNew = async () => {
    if (!newRow.name.trim() || !newRow.surname.trim()) return
    markSaving('new', true)
    setError('')
    try {
      const created = await usersApi.create({
        name:        newRow.name.trim(),
        surname:     newRow.surname.trim(),
        email:       newRow.email.trim() || null,
        position_id: newRow.position_id ? Number(newRow.position_id) : null,
      })
      setUsers(prev => [...prev, created])
      setNewRow({ name: '', surname: '', email: '', position_id: '' })
    } catch (e) {
      setError('Błąd przy dodawaniu użytkownika')
    }
    markSaving('new', false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '100%', boxSizing: 'border-box',
    border: 'none', borderRadius: 0, padding: '0 8px', fontSize: 13,
    background: 'transparent', color: '#111827', outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', height: '100%', boxSizing: 'border-box',
    border: 'none', borderRadius: 0, padding: '0 6px', fontSize: 13,
    background: 'transparent', color: '#111827', outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: '#dbeafe', borderBottom: '1px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Pracownicy ({users.filter(u => u.is_active).length} aktywnych)</span>
          {saving.size > 0 && <span style={{ fontSize: 11, color: '#60a5fa' }}>Zapisywanie...</span>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '13%' }} /> {/* Imię */}
            <col style={{ width: '15%' }} /> {/* Nazwisko */}
            <col style={{ width: '17%' }} /> {/* Stanowisko */}
            <col style={{ width: '13%' }} /> {/* Login */}
            <col style={{ width: '19%' }} /> {/* E-mail */}
            <col style={{ width: '7%'  }} /> {/* Aktywny */}
            <col style={{ width: '16%' }} /> {/* Reset hasła */}
          </colgroup>
          <thead>
            <tr>
              {['Imię', 'Nazwisko', 'Stanowisko', 'Login', 'E-mail', 'Aktywny', 'Reset hasła'].map((h, i) => (
                <th key={h} style={{ ...TH_STYLE, textAlign: (i === 5 || i === 6) ? 'center' : 'left', borderRight: i === 6 ? 'none' : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ background: u.is_active ? '#fff' : '#f9fafb', opacity: u.is_active ? 1 : 0.6 }}>
                {/* Imię */}
                <td style={{ ...CELL, padding: 0, height: 34 }}>
                  <input style={inputStyle} value={u.name}
                    onChange={e => setUsers(prev => prev.map(r => r.id === u.id ? { ...r, name: e.target.value } : r))}
                    onBlur={e => updateField(u.id, 'name', e.target.value)}
                    onFocus={e => { e.currentTarget.style.outline = '2px solid #3b82f6'; e.currentTarget.style.outlineOffset = '-2px' }}
                  />
                </td>
                {/* Nazwisko */}
                <td style={{ ...CELL, padding: 0, height: 34 }}>
                  <input style={inputStyle} value={u.surname}
                    onChange={e => setUsers(prev => prev.map(r => r.id === u.id ? { ...r, surname: e.target.value } : r))}
                    onBlur={e => updateField(u.id, 'surname', e.target.value)}
                    onFocus={e => { e.currentTarget.style.outline = '2px solid #3b82f6'; e.currentTarget.style.outlineOffset = '-2px' }}
                  />
                </td>
                {/* Stanowisko */}
                <td style={{ ...CELL, padding: 0, height: 34 }}>
                  <select style={selectStyle} value={u.position_id ?? ''}
                    onChange={e => updateField(u.id, 'position_id', e.target.value ? Number(e.target.value) as unknown as string : null as unknown as string)}
                  >
                    <option value="">—</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                {/* Login (read-only) */}
                <td style={{ ...CELL, padding: '0 8px', height: 34, fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>
                  {loginOf(u)}
                </td>
                {/* E-mail */}
                <td style={{ ...CELL, padding: 0, height: 34 }}>
                  <input style={inputStyle} value={u.email ?? ''}
                    onChange={e => setUsers(prev => prev.map(r => r.id === u.id ? { ...r, email: e.target.value } : r))}
                    onBlur={e => updateField(u.id, 'email', e.target.value || null as unknown as string)}
                    onFocus={e => { e.currentTarget.style.outline = '2px solid #3b82f6'; e.currentTarget.style.outlineOffset = '-2px' }}
                    placeholder="—"
                  />
                </td>
                {/* Aktywny */}
                <td style={{ ...CELL, padding: 0, height: 34, textAlign: 'center' }}>
                  <button
                    onClick={() => toggleActive(u)}
                    title={u.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      padding: '4px 6px', borderRadius: 4,
                      color: u.is_active ? '#16a34a' : '#9ca3af',
                      fontSize: 16, lineHeight: 1,
                    }}
                  >
                    {u.is_active ? '✓' : '○'}
                  </button>
                </td>
                {/* Reset hasła */}
                <td style={{ borderRight: 'none', ...CELL, padding: '0 6px', height: 34, textAlign: 'center' }}>
                  {(() => {
                    const state = resetLinks[u.id]
                    if (!state) return (
                      <button onClick={() => generateReset(u)}
                        style={{ border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#2563eb' }}>
                        Generuj link
                      </button>
                    )
                    if (state === 'loading') return (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>...</span>
                    )
                    if (state === '__copied__') return (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Skopiowano</span>
                    )
                    return (
                      <button onClick={() => copyLink(u)} title={state}
                        style={{ border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#15803d' }}>
                        Kopiuj link
                      </button>
                    )
                  })()}
                </td>
              </tr>
            ))}

            {/* Nowy pracownik */}
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ ...CELL, padding: 0, height: 34, borderTop: '2px solid #e2e8f0' }}>
                <input style={inputStyle} value={newRow.name} placeholder="Imię"
                  onChange={e => setNewRow(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveNew() }} />
              </td>
              <td style={{ ...CELL, padding: 0, height: 34, borderTop: '2px solid #e2e8f0' }}>
                <input style={inputStyle} value={newRow.surname} placeholder="Nazwisko"
                  onChange={e => setNewRow(p => ({ ...p, surname: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveNew() }} />
              </td>
              <td style={{ ...CELL, padding: 0, height: 34, borderTop: '2px solid #e2e8f0' }}>
                <select style={selectStyle} value={newRow.position_id}
                  onChange={e => setNewRow(p => ({ ...p, position_id: e.target.value }))}>
                  <option value="">— stanowisko —</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
              <td style={{ ...CELL, padding: '0 8px', height: 34, fontSize: 12, color: '#9ca3af', borderTop: '2px solid #e2e8f0', fontFamily: 'monospace' }}>
                {newRow.surname && newRow.name ? newRow.surname + newRow.name[0] : '—'}
              </td>
              <td style={{ ...CELL, padding: 0, height: 34, borderTop: '2px solid #e2e8f0' }}>
                <input style={inputStyle} value={newRow.email} placeholder="E-mail (opcjonalnie)"
                  onChange={e => setNewRow(p => ({ ...p, email: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveNew() }} />
              </td>
              <td style={{ ...CELL, padding: '0 6px', height: 34, borderTop: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(newRow.name && newRow.surname) && (
                  <button onClick={saveNew} disabled={saving.has('new')}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {saving.has('new') ? '...' : 'Dodaj'}
                  </button>
                )}
              </td>
              <td style={{ borderRight: 'none', borderTop: '2px solid #e2e8f0' }} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'ogolne', label: 'Ogólne',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14M12 2v2m0 16v2M2 12h2m16 0h2"/>
      </svg>
    ),
  },
  {
    id: 'konto', label: 'Konto',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    id: 'dane', label: 'Materiały i Kooperacje',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
  {
    id: 'pracownicy', label: 'Pracownicy',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user: authUser, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('ogolne')

  const visibleTabs = TABS.filter(t => t.id !== 'pracownicy' || authUser?.is_admin)

  return (
    <div style={{ height: '100%', display: 'flex', background: '#f8fafc', overflow: 'hidden' }}>

      {/* ── Left tab sidebar ── */}
      <div style={{
        width: 210, flexShrink: 0, height: '100%',
        background: '#fff', borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
        paddingTop: 0,
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Ustawienia
          </div>
        </div>
        <div style={{ padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 12px', borderRadius: 6, border: 'none', width: '100%',
                textAlign: 'left', fontSize: 13, cursor: 'pointer',
                background:  tab === t.id ? '#dbeafe' : 'transparent',
                color:       tab === t.id ? '#1e40af' : '#4b5563',
                fontWeight:  tab === t.id ? 600 : 400,
                transition:  'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.background = '#f1f5f9' }}
              onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ opacity: tab === t.id ? 1 : 0.55, flexShrink: 0 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Wyloguj — na dole sidebara */}
        <div style={{ padding: '8px 8px', borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 12px', borderRadius: 6, border: 'none', width: '100%',
              textAlign: 'left', fontSize: 13, cursor: 'pointer',
              background: 'transparent', color: '#dc2626', fontWeight: 400,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Wyloguj się
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page title bar — matching app style */}
        <div style={{ flexShrink: 0, padding: '22px 28px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
            {TABS.find(t => t.id === tab)?.label}
          </h1>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          {tab === 'ogolne' && <TabOgolne />}
          {tab === 'konto' && <TabKonto />}
          {tab === 'pracownicy' && <TabPracownicy />}
          {tab === 'dane' && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <MaterialsTable />
              <CooperationsTable />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
