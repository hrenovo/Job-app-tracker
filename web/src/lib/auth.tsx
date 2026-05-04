import { createContext, useContext, useEffect, useState } from 'react'
import { clearTokens, setTokens, type User } from './api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<User>
  register: (username: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Restore user from localStorage on mount
    try {
      const stored = localStorage.getItem('user_data')
      if (stored && localStorage.getItem('access_token')) {
        setUser(JSON.parse(stored))
      }
    } catch {
      // Corrupted data — clear it
      clearTokens()
    } finally {
      setIsLoading(false)
    }

    // Handle session expiry from refresh lock
    const handleExpiry = () => {
      setUser(null)
    }
    window.addEventListener('auth:session-expired', handleExpiry)
    return () => window.removeEventListener('auth:session-expired', handleExpiry)
  }, [])

  const login = async (username: string, password: string): Promise<User> => {
    const res = await fetch('/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Invalid credentials')
    }
    const data = await res.json()
    setTokens(data.access, data.refresh)
    localStorage.setItem('user_data', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const register = async (username: string, email: string, password: string): Promise<User> => {
    const res = await fetch('/api/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Registration failed')
    }
    const data = await res.json()
    setTokens(data.access, data.refresh)
    localStorage.setItem('user_data', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = async (): Promise<void> => {
    const refresh = localStorage.getItem('refresh_token')
    try {
      if (refresh) {
        await fetch('/api/auth/logout/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ refresh }),
        })
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearTokens()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
