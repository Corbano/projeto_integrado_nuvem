import { ShieldAlert } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import type { Role } from '../../shared/api/types'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { EmptyState, PageHeader } from '../../shared/ui'
import { useAuth } from './useAuth'

function Forbidden() {
  useDocumentTitle('Sem permissão')
  return (
    <>
      <PageHeader title="Sem permissão" />
      <EmptyState
        icon={<ShieldAlert strokeWidth={1.75} />}
        title="Seu perfil não tem acesso a esta página"
        description="Se precisar dela, peça a um administrador."
        action={
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-controle border border-azul bg-azul px-4 text-corpo font-semibold text-white hover:border-azul-escuro hover:bg-azul-escuro"
          >
            Voltar ao início
          </Link>
        }
      />
    </>
  )
}

/** Renderiza dentro do AppShell (que fornece o <main>). */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { can } = useAuth()
  return can(...roles) ? <Outlet /> : <Forbidden />
}
