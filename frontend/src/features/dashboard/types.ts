import type { StatTrend } from '../../shared/ui'

/** Formatos de dados dos widgets da Início. Quando a API existir, ela devolve estes formatos. */

export interface KpiItem {
  id: 'faturamento' | 'ordens' | 'veiculos' | 'estoque'
  label: string
  /** Valor já formatado, ex.: "R$ 48.920". */
  value: string
  trend: StatTrend
}

export interface SeriesPoint {
  /** Rótulo do dia, ex.: "12 nov". */
  label: string
  value: number
}

export interface RevenueSeries {
  id: 'receita' | 'despesas' | 'lucro'
  label: string
  points: SeriesPoint[]
}

export interface BudgetItem {
  id: string
  label: string
  /** Valor gasto no mês (R$). */
  used: number
  /** Orçamento do mês (R$). */
  budget: number
}

export type JobStatus = 'Em andamento' | 'Aguardando peça' | 'Em revisão' | 'Pronto para entrega'

export interface JobItem {
  id: string
  plate: string
  vehicle: string
  service: string
  mechanic: string
  /** Prazo em texto, ex.: "Hoje, 17h". */
  due: string
  /** 0 a 100. */
  progress: number
  status: JobStatus
}

export interface AgendaDay {
  id: string
  weekday: string
  day: number
  today: boolean
}

export interface AppointmentItem {
  id: string
  time: string
  client: string
  vehicle: string
  plate: string
  service: string
}

export type MechanicStatus = 'Em serviço' | 'Intervalo' | 'Disponível'

export interface MechanicItem {
  id: string
  name: string
  specialty: string
  status: MechanicStatus
  /** Horário de entrada ou de início do intervalo, ex.: "08:30". */
  since: string
}

export type AlertLevel = 'critico' | 'atencao' | 'ok'

export interface MaintenanceAlertItem {
  id: string
  level: AlertLevel
  title: string
  detail: string
}

export type HistoryKind = 'freio' | 'oleo' | 'pneu'

export interface HistoryEntry {
  id: string
  kind: HistoryKind
  /** Data por extenso, ex.: "4 de outubro de 2026". */
  date: string
  title: string
  shop: string
  /** Valor em R$. */
  value: number
}

export interface VehicleSample {
  plate: string
  model: string
  km: number
  nextService: string
}
