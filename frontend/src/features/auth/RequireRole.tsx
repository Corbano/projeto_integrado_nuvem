import { Link, Outlet } from 'react-router-dom'
import type { Role } from '../../shared/api/types'
import { useAuth } from './useAuth'

export function RequireRole({ roles }: { roles: Role[] }) {
  const { can } = useAuth()
  if (can(...roles)) return <Outlet />
  return (
    <main className="p-8">
      <h1 className="text-titulo text-tinta">Sem permissão</h1>
      <p className="mt-2 max-w-[60ch] text-corpo text-tinta-suave">
        Seu perfil não tem acesso a esta página. Se precisar dela, peça a um administrador.
      </p>
      <Link to="/" className="mt-4 inline-block text-corpo font-semibold text-azul underline underline-offset-2">
        Voltar ao início
      </Link>
    </main>
  )
}
