import { useEffect, useState } from 'react'
import { PageHeader, StatusPill } from '../../shared/ui'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useAuth } from '../auth/useAuth'
import { greetingFor } from './greeting'
import { ModuleCard } from './ModuleCard'
import { modulesForRole } from './modules'
import { useApiStatus } from './useApiStatus'
import type { ApiStatus } from './useApiStatus'

function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function ApiStatusPill({ status }: { status: ApiStatus }) {
  if (status === 'online') return <StatusPill variant="ok">API online</StatusPill>
  if (status === 'offline') return <StatusPill variant="critical">API offline</StatusPill>
  return <StatusPill variant="neutral">Verificando a API…</StatusPill>
}

export function HomePage() {
  useDocumentTitle('Início')
  const { user } = useAuth()
  const now = useNow()
  const status = useApiStatus()
  const modules = modulesForRole(user?.role)
  const firstName = user?.name.trim().split(/\s+/)[0] ?? ''

  return (
    <>
      <PageHeader
        title={`${greetingFor(now)}, ${firstName}`}
        subtitle="Escolha uma funcionalidade para começar. O que ainda não está pronto aparece como “Em breve”."
        actions={
          <span role="status" aria-live="polite">
            <ApiStatusPill status={status} />
          </span>
        }
      />

      <section aria-labelledby="funcionalidades">
        <h2 id="funcionalidades" className="mb-5 text-secao font-bold text-navy">
          Funcionalidades
        </h2>
        <div className="@container">
          <ul className="grid grid-cols-1 gap-5 @min-[560px]:grid-cols-2 @min-[1040px]:grid-cols-4 @min-[1040px]:gap-6">
            {modules.map((module) => (
              <li key={module.id} className="flex">
                <ModuleCard module={module} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
