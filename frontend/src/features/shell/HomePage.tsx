import { useEffect, useMemo, useState } from 'react'
import { PageHeader, ProgressBar, StatusPill } from '../../shared/ui'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useAuth } from '../auth/useAuth'
import {
  ActiveMechanics,
  BudgetDonuts,
  JobCards,
  KpiRow,
  MaintenanceAlerts,
  RevenueChart,
  TodayAgenda,
  VehicleTimeline,
} from '../dashboard'
import {
  buildAgendaDays,
  buildRevenueSeries,
  demoAlerts,
  demoAppointments,
  demoBudgets,
  demoHistory,
  demoJobs,
  demoKpis,
  demoMechanics,
  demoVehicle,
} from '../dashboard/demo-data'
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
  const finished = modules.filter((m) => m.available).length
  const revenue = useMemo(() => buildRevenueSeries(now), [now])
  const agendaDays = useMemo(() => buildAgendaDays(now), [now])
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
        <div className="mb-6 max-w-md">
          <p data-testid="resumo-modulos" className="mb-2 text-corpo font-semibold text-tinta">
            {finished} de {modules.length} módulos concluídos
          </p>
          <ProgressBar
            value={finished}
            max={modules.length}
            label={`${finished} de ${modules.length} módulos concluídos`}
            tone="azul"
          />
        </div>
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

      <section aria-labelledby="visao-geral" className="mt-12">
        <h2 id="visao-geral" className="mb-5 text-secao font-bold text-navy">
          Visão geral da oficina
        </h2>
        <div className="@container flex flex-col gap-6">
          <KpiRow items={demoKpis} />
          <div className="grid grid-cols-1 items-start gap-6 @min-[1040px]:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <RevenueChart series={revenue} />
              <BudgetDonuts items={demoBudgets} />
              <JobCards items={demoJobs} />
              <VehicleTimeline vehicle={demoVehicle} history={demoHistory} />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <TodayAgenda days={agendaDays} items={demoAppointments} />
              <MaintenanceAlerts items={demoAlerts} />
              <ActiveMechanics items={demoMechanics} />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
