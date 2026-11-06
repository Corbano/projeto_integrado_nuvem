import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { apiFetch, setUnauthorizedHandler } from '../../shared/api/client'
import { ApiError } from '../../shared/api/errors'
import type { Role, TokenResponse, User } from '../../shared/api/types'
import { clearToken, getToken, setToken } from './storage'
import { AuthContext } from './useAuth'
import type { AuthContextValue, AuthStatus, SessionEnd } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'))
  const [sessionEnd, setSessionEnd] = useState<SessionEnd>(null)

  // Incrementa a cada login/fim de sessão: resultados de chamadas antigas são descartados.
  const sessionRef = useRef(0)

  const endSession = useCallback((reason: Exclude<SessionEnd, null>) => {
    sessionRef.current += 1
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
    const token = getToken()
    if (!token) return
    const session = sessionRef.current
    const controller = new AbortController()
    const stale = () => controller.signal.aborted || sessionRef.current !== session || getToken() !== token
    apiFetch<User>('/auth/me', { signal: controller.signal })
      .then((me) => {
        if (stale()) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (stale()) return
        if (error instanceof ApiError && error.status === 401) {
          endSession('expired')
        } else {
          // Rede ou 5xx: segue como anônimo, mas mantém o token para uma nova tentativa ao recarregar.
          setStatus('anonymous')
        }
      })
    return () => controller.abort()
  }, [endSession])

  const login = useCallback(async (email: string, password: string) => {
    const session = ++sessionRef.current
    const { access_token } = await apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    if (sessionRef.current !== session) return
    setToken(access_token)
    try {
      const me = await apiFetch<User>('/auth/me')
      if (sessionRef.current !== session) return
      setUser(me)
      setSessionEnd(null)
      setStatus('authenticated')
    } catch (error) {
      if (sessionRef.current === session) clearToken()
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
