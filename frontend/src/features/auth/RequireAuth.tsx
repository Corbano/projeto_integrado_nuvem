import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export interface LoginState {
  from?: string
  expired?: boolean
}

export function RequireAuth() {
  const { status, sessionEnd } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <p role="status" className="p-8 text-corpo text-tinta-suave">
        Carregando...
      </p>
    )
  }
  if (status === 'anonymous') {
    const state: LoginState =
      sessionEnd === 'logout'
        ? {}
        : { from: location.pathname + location.search + location.hash, expired: sessionEnd === 'expired' }
    return <Navigate to="/entrar" replace state={state} />
  }
  return <Outlet />
}
