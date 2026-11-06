import { createContext, useContext } from 'react'
import type { Role, User } from '../../shared/api/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'
/** Por que a sessão terminou: 'logout' (pedido do usuário) ou 'expired' (401 / token inválido). */
export type SessionEnd = 'logout' | 'expired' | null

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  sessionEnd: SessionEnd
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  can: (...roles: Role[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
