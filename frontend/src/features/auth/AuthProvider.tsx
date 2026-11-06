import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiFetch, setUnauthorizedHandler } from '../../shared/api/client'
import type { Role, TokenResponse, User } from '../../shared/api/types'
import { clearToken, getToken, setToken } from './storage'
import { AuthContext } from './useAuth'
import type { AuthContextValue, AuthStatus, SessionEnd } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'))
  const [sessionEnd, setSessionEnd] = useState<SessionEnd>(null)

  const endSession = useCallback((reason: Exclude<SessionEnd, null>) => {
    clearToken()
    setUser(null)
    setStatus('anonymous')
    setSessionEnd(reason)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => endSession('expired'))
    return () => setUnauthorizedHandler(null)
  }, [endSession])

  useEffect(() => {
    if (!getToken()) return
    const controller = new AbortController()
    apiFetch<User>('/auth/me', { signal: controller.signal })
      .then((me) => {
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        // Token inválido, expirado ou API fora do ar: segue como anônimo.
        endSession('expired')
      })
    return () => controller.abort()
  }, [endSession])

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    setToken(access_token)
    try {
      const me = await apiFetch<User>('/auth/me')
      setUser(me)
      setSessionEnd(null)
      setStatus('authenticated')
    } catch (error) {
      clearToken()
      throw error
    }
  }, [])

  const logout = useCallback(() => endSession('logout'), [endSession])

  const can = useCallback((...roles: Role[]) => user !== null && roles.includes(user.role), [user])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, sessionEnd, login, logout, can }),
    [user, status, sessionEnd, login, logout, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
