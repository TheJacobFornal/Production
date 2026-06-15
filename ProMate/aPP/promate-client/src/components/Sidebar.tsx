import { useState } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}

function IconProduction() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3"  y="3"  width="7" height="7" rx="1"/>
      <rect x="14" y="3"  width="7" height="7" rx="1"/>
      <rect x="3"  y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function IconOrders() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9"  y1="12" x2="15" y2="12"/>
      <line x1="9"  y1="16" x2="13" y2="16"/>
    </svg>
  )
}

function IconData() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="3"  y1="20" x2="21" y2="20"/>
    </svg>
  )
}

function IconHandlowka() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface TooltipState { label: string; y: number }

export default function Sidebar() {
  const navigate  = useNavigate()
  const [tip, setTip] = useState<TooltipState | null>(null)

  // Extract orderNumber from any order-related route
  const matchOrder       = useMatch('/orders/:orderNumber')
  const matchPlanning    = useMatch('/orders/:orderNumber/planowanie')
  const matchDetailOld   = useMatch('/orders/:orderNumber/poprodukcyjne')
  const matchDetailNew   = useMatch('/poprodukcyjne')
  const orderNumber      =
    matchOrder?.params.orderNumber    ??
    matchPlanning?.params.orderNumber ??
    matchDetailOld?.params.orderNumber

  const matchHome      = useMatch('/home')
  const matchHandlowka = useMatch('/handlowka')
  const isHome         = !!matchHome
  const isProduction   = !!matchPlanning
  const isDetail       = !!matchDetailNew || !!matchDetailOld
  const isHandlowka    = !!matchHandlowka

  const items = [
    {
      id:       'home',
      label:    'Strona główna',
      icon:     <IconHome />,
      active:   isHome,
      disabled: false,
      onClick:  () => navigate('/home'),
    },
    {
      id:       'orders',
      label:    'Zamówienia',
      icon:     <IconOrders />,
      active:   false,
      disabled: false,
      onClick:  () => navigate('/orders'),
    },
    {
      id:       'detail',
      label:    'Dane poprodukcyjne',
      icon:     <IconData />,
      active:   isDetail,
      disabled: false,
      onClick:  () => navigate('/poprodukcyjne'),
    },
    {
      id:       'handlowka',
      label:    'Zamówienia Handlówki',
      icon:     <IconHandlowka />,
      active:   isHandlowka,
      disabled: false,
      onClick:  () => navigate('/handlowka'),
    },
  ]

  return (
    <>
      {/* ── Sidebar strip ─────────────────────────────────────────────── */}
      <div style={{
        width: 56, flexShrink: 0, height: '100%',
        background: '#1e40af',
        borderRight: '1px solid #1e3a8a',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 10, paddingBottom: 12, gap: 2,
        boxShadow: '2px 0 8px rgba(0,0,0,0.25)',
        zIndex: 40,
      }}>

        {/* Mini logo */}
        <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
          <img
            src="/Logo_white.png"
            alt="PM"
            style={{ width: 34, objectFit: 'contain' }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 30, height: 1, background: '#3b82f6', marginBottom: 8 }} />

        {/* Nav items */}
        {items.map(item => (
          <div
            key={item.id}
            style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 2 }}
            onMouseEnter={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setTip({ label: item.label, y: rect.top + rect.height / 2 })
            }}
            onMouseLeave={() => setTip(null)}
          >
            {/* Active left bar */}
            {item.active && (
              <div style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 3, height: 28, background: '#3b82f6',
                borderRadius: '0 2px 2px 0',
              }} />
            )}

            <button
              onClick={item.onClick}
              disabled={item.disabled}
              style={{
                width: 38, height: 38, borderRadius: 8,
                border: 'none', padding: 0,
                cursor: item.disabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: item.active ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: item.disabled ? '#93c5fd' : item.active ? '#ffffff' : '#bfdbfe',
                transition: 'background 0.12s, color 0.12s',
                outline: 'none',
              }}
              onMouseEnter={e => {
                if (!item.disabled && !item.active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.color = '#ffffff'
                }
              }}
              onMouseLeave={e => {
                if (!item.active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = item.disabled ? '#93c5fd' : '#bfdbfe'
                }
              }}
            >
              {item.icon}
            </button>
          </div>
        ))}
      </div>

      {/* ── Tooltip (position:fixed escapes overflow:hidden) ───────────── */}
      {tip && (
        <div style={{
          position: 'fixed',
          left: 64,
          top: tip.y,
          transform: 'translateY(-50%)',
          background: '#0f172a',
          color: '#e2e8f0',
          padding: '5px 11px',
          borderRadius: 6,
          fontSize: 12, fontWeight: 500,
          whiteSpace: 'nowrap',
          zIndex: 9999,
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}>
          {tip.label}
          {/* Arrow pointing left */}
          <div style={{
            position: 'absolute',
            right: '100%', top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: '5px solid #0f172a',
          }} />
        </div>
      )}
    </>
  )
}
