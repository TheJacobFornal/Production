import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'

export default function ResetPasswordPage() {
  const [params]    = useSearchParams()
  const navigate    = useNavigate()
  const token       = params.get('token') ?? ''

  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [userName,  setUserName]  = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setError('Brak tokenu — link jest nieprawidłowy'); return }
    authApi.resetInfo(token)
      .then(u => setUserName(`${u.name} ${u.surname}`))
      .catch(() => setError('Link wygasł lub jest nieprawidłowy'))
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6)      { setError('Hasło musi mieć minimum 6 znaków'); return }
    if (password !== password2)   { setError('Hasła nie są identyczne'); return }
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch {
      setError('Link wygasł lub jest nieprawidłowy. Poproś admina o nowy.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 14px', fontSize: 15,
    border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
    color: '#111827', background: '#f9fafb',
  }

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
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', marginBottom: 14,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>Nowe hasło</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>ProMate — resetowanie hasła</div>
          {userName && (
            <div style={{
              marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 20, padding: '4px 14px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{userName}</span>
            </div>
          )}
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#f0fdf4', border: '2px solid #86efac',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24,
            }}>✓</div>
            <p style={{ fontSize: 15, color: '#166534', fontWeight: 600, margin: '0 0 8px' }}>Hasło zostało zmienione</p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Możesz teraz zalogować się nowym hasłem.</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              style={{
                width: '100%', padding: '11px', background: '#2563eb',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Przejdź do logowania
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                NOWE HASŁO
              </label>
              <input
                type="password" value={password} autoFocus
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="min. 6 znaków"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px #bfdbfe' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                POWTÓRZ HASŁO
              </label>
              <input
                type="password" value={password2}
                onChange={e => { setPassword2(e.target.value); setError('') }}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px #bfdbfe' }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

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
              type="submit" disabled={loading || !token}
              style={{
                width: '100%', padding: '11px',
                background: (loading || !token) ? '#93c5fd' : '#2563eb',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700,
                cursor: (loading || !token) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
