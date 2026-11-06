/*
 * DADOS DE EXEMPLO, a serem substituídos por chamadas à API.
 *
 * Todos os números, nomes e placas deste arquivo são fictícios (nomes brasileiros
 * plausíveis, nenhuma pessoa real). Ele é o único lugar com valores de demonstração
 * da página Início: os widgets recebem tudo por props, então trocar este arquivo por
 * dados da API não exige mudar a interface. Nada daqui é enviado ao backend nem
 * persistido.
 */
import type {
  AgendaDay,
  AppointmentItem,
  BudgetItem,
  HistoryEntry,
  JobItem,
  KpiItem,
  MaintenanceAlertItem,
  MechanicItem,
  RevenueSeries,
  VehicleSample,
} from './types'

export const demoKpis: KpiItem[] = [
  {
    id: 'faturamento',
    label: 'Faturamento do mês',
    value: 'R$ 48.920',
    trend: { value: 12.4, label: 'vs. mês anterior' },
  },
  { id: 'ordens', label: 'Ordens abertas', value: '23', trend: { value: 4.5, label: 'vs. semana passada' } },
  {
    id: 'veiculos',
    label: 'Veículos na oficina',
    value: '14',
    trend: { value: -6.7, label: 'vs. semana passada', positiveIsGood: false },
  },
  {
    id: 'estoque',
    label: 'Estoque crítico (itens)',
    value: '7',
    trend: { value: 16.7, label: 'vs. semana passada', positiveIsGood: false },
  },
]

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 30 dias terminando em `end`, com ondulação fixa (sem aleatoriedade, para o gráfico ser estável). */
export function buildRevenueSeries(end: Date = new Date()): RevenueSeries[] {
  const receita: RevenueSeries['points'] = []
  const despesas: RevenueSeries['points'] = []
  const lucro: RevenueSeries['points'] = []
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i)
    const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`
    const weekend = date.getDay() === 0 || date.getDay() === 6
    const wave = Math.sin((29 - i) / 3.2) * 520 + Math.cos((29 - i) / 1.7) * 210
    const trend = (29 - i) * 14
    const income = Math.round(Math.max(380, (weekend ? 900 : 1750) + wave + trend) / 10) * 10
    const cost = Math.round((income * 0.58 + Math.sin((29 - i) / 2.4) * 140) / 10) * 10
    receita.push({ label, value: income })
    despesas.push({ label, value: cost })
    lucro.push({ label, value: income - cost })
  }
  return [
    { id: 'receita', label: 'Receita', points: receita },
    { id: 'despesas', label: 'Despesas', points: despesas },
    { id: 'lucro', label: 'Lucro', points: lucro },
  ]
}

export const demoBudgets: BudgetItem[] = [
  { id: 'pecas', label: 'Peças', used: 14210, budget: 38000 },
  { id: 'insumos', label: 'Insumos', used: 3380, budget: 9500 },
  { id: 'mao-de-obra', label: 'Mão de obra', used: 17250, budget: 26000 },
]

export const demoJobs: JobItem[] = [
  {
    id: 'os-1',
    plate: 'RIO2A18',
    vehicle: 'Chevrolet Onix 2020',
    service: 'Revisão e troca de óleo',
    mechanic: 'Rogério Almeida',
    due: 'Hoje, 16h',
    progress: 72,
    status: 'Em andamento',
  },
  {
    id: 'os-2',
    plate: 'FQT4B91',
    vehicle: 'Volkswagen Gol 2017',
    service: 'Troca de pastilhas e discos',
    mechanic: 'Carla Mendonça',
    due: 'Hoje, 18h',
    progress: 45,
    status: 'Aguardando peça',
  },
  {
    id: 'os-3',
    plate: 'GHJ7C05',
    vehicle: 'Fiat Strada 2022',
    service: 'Alinhamento e balanceamento',
    mechanic: 'Wesley Ramos',
    due: 'Amanhã, 10h',
    progress: 88,
    status: 'Em revisão',
  },
  {
    id: 'os-4',
    plate: 'KLM3D47',
    vehicle: 'Toyota Corolla 2019',
    service: 'Correia dentada e bomba d’água',
    mechanic: 'Denise Farias',
    due: 'Amanhã, 17h',
    progress: 100,
    status: 'Pronto para entrega',
  },
]

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Faixa de 7 dias: 3 antes de hoje, hoje e 3 depois. */
export function buildAgendaDays(now: Date = new Date()): AgendaDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index - 3)
    return {
      id: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      weekday: WEEKDAYS[date.getDay()],
      day: date.getDate(),
      today: index === 3,
    }
  })
}

export const demoAppointments: AppointmentItem[] = [
  {
    id: 'ag-1',
    time: '08:30',
    client: 'Marcos Vinícius Teixeira',
    vehicle: 'Honda Civic 2018',
    plate: 'BRA2E19',
    service: 'Diagnóstico de motor',
  },
  {
    id: 'ag-2',
    time: '10:00',
    client: 'Fernanda Lacerda',
    vehicle: 'Hyundai HB20 2021',
    plate: 'QWE5F62',
    service: 'Revisão dos 30 mil km',
  },
  {
    id: 'ag-3',
    time: '13:30',
    client: 'Anderson Pacheco',
    vehicle: 'Ford Ranger 2016',
    plate: 'MNB8G30',
    service: 'Troca de embreagem',
  },
  {
    id: 'ag-4',
    time: '15:00',
    client: 'Luciana Prado',
    vehicle: 'Renault Kwid 2023',
    plate: 'TYU1H76',
    service: 'Rodízio de pneus',
  },
]

export const demoMechanics: MechanicItem[] = [
  { id: 'm-1', name: 'Rogério Almeida', specialty: 'Motor e injeção', status: 'Em serviço', since: '07:45' },
  { id: 'm-2', name: 'Carla Mendonça', specialty: 'Freios e suspensão', status: 'Em serviço', since: '08:00' },
  { id: 'm-3', name: 'Wesley Ramos', specialty: 'Alinhamento e pneus', status: 'Intervalo', since: '12:10' },
  { id: 'm-4', name: 'Denise Farias', specialty: 'Elétrica e diagnóstico', status: 'Disponível', since: '08:30' },
]

export const demoAlerts: MaintenanceAlertItem[] = [
  {
    id: 'al-1',
    level: 'critico',
    title: 'Troca de óleo vencida há 800 km',
    detail: 'Chevrolet Onix · RIO2A18',
  },
  {
    id: 'al-2',
    level: 'critico',
    title: 'Estoque crítico: filtro de ar',
    detail: '2 unidades, mínimo de 10',
  },
  {
    id: 'al-3',
    level: 'atencao',
    title: 'Rodízio de pneus em 400 km',
    detail: 'Renault Kwid · TYU1H76',
  },
  {
    id: 'al-4',
    level: 'atencao',
    title: 'Revisão dos 50 mil em 12 dias',
    detail: 'Toyota Corolla · KLM3D47',
  },
  {
    id: 'al-5',
    level: 'ok',
    title: 'Freios e fluido em dia',
    detail: 'Fiat Strada · GHJ7C05',
  },
]

export const demoVehicle: VehicleSample = {
  plate: 'BRA2E19',
  model: 'Honda Civic EXL 2018',
  km: 47820,
  nextService: 'troca de óleo em 1.200 km',
}

export const demoHistory: HistoryEntry[] = [
  {
    id: 'h-1',
    kind: 'freio',
    date: '4 de outubro de 2026',
    title: 'Pastilhas e discos de freio',
    shop: 'Auto Center',
    value: 631.26,
  },
  {
    id: 'h-2',
    kind: 'oleo',
    date: '12 de julho de 2026',
    title: 'Troca de óleo e filtro',
    shop: 'Auto Center',
    value: 89,
  },
  {
    id: 'h-3',
    kind: 'pneu',
    date: '20 de maio de 2026',
    title: 'Rodízio de pneus',
    shop: 'Auto Center',
    value: 40,
  },
]
