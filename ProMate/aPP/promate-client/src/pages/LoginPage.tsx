import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [loginVal,  setLoginVal]  = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [needsPass, setNeedsPass] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!loginVal.trim()) { setError('Podaj login'); return }
    setError('')
    setLoading(true)
    try {
      const user = await authApi.login(loginVal.trim(), password || undefined)
      login(user)
      navigate('/home', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('401') && !needsPass) {
        // Może brak hasła — pokaż pole hasła i spróbuj ponownie
        setNeedsPass(true)
        setError('Podaj hasło')
      } else {
        setError('Nieprawidłowy login lub hasło')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    padding: '10px 14px', fontSize: 15,
    border: `1px solid ${hasError ? '#ef4444' : '#d1d5db'}`,
    borderRadius: 8, outline: 'none',
    color: '#111827', background: '#f9fafb',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    }}>
      <div style={{
        width: 380, background: '#fff',
        borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            marginBottom: 14,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e40af', letterSpacing: '-0.5px' }}>ProMate</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>System zarządzania produkcją</div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Login */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: '0.03em' }}>
              LOGIN
            </label>
            <input
              type="text"
              value={loginVal}
              onChange={e => { setLoginVal(e.target.value); setError(''); setNeedsPass(false); setPassword('') }}
              placeholder="np. KowalskiJ"
              autoFocus
              autoComplete="username"
              style={inputStyle()}
              onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px #bfdbfe' }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
              Format: Nazwisko + pierwsza litera imienia
            </div>
          </div>

          {/* Hasło — pokazuje się zawsze gdy needsPass lub gdy user sam wpisał coś */}
          {(needsPass) && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, letterSpacing: '0.03em' }}>
                HASŁO
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                autoFocus
                autoComplete="current-password"
                style={inputStyle(!!error)}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px #bfdbfe' }}
                onBlur={e  => { e.currentTarget.style.borderColor = error ? '#ef4444' : '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: '9px 12px', borderRadius: 7, marginBottom: 16,
              background: '#fef2f2', border: '1px solid #fecaca',
              fontSize: 12, color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1d4ed8' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#2563eb' }}
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </div>
  )
}
