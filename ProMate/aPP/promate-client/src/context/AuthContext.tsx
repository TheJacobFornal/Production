import { createContext, useContext, useState, ReactNode } from 'react'

export interface AuthUser {
  id:            number
  name:          string
  surname:       string
  email:         string | null
  position_name: string | null
  is_admin:      boolean
}

interface AuthContextType {
  user:   AuthUser | null
  login:  (user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_KEY = 'promate_user'

function loadUser(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') }
  catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  function login(u: AuthUser) {
    setUser(u)
    localStorage.setItem(AUTH_KEY, JSON.stringify(u))
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be within AuthProvider')
  return ctx
}
