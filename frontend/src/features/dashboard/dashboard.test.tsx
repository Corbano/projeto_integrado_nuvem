import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  ActiveMechanics,
  BudgetDonuts,
  JobCards,
  KpiRow,
  MaintenanceAlerts,
  RevenueChart,
  TodayAgenda,
  VehicleTimeline,
} from '.'
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
} from './demo-data'

const NOW = new Date(2026, 10, 6)

describe('KpiRow', () => {
  it('mostra 4 indicadores com a tendência em texto e a etiqueta de exemplo', () => {
    render(<KpiRow items={demoKpis} />)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
    expect(screen.getByText('R$ 48.920')).toBeInTheDocument()
    expect(screen.getByText('Alta de 12,4%')).toBeInTheDocument()
    expect(screen.getByText('Queda de 6,7%')).toBeInTheDocument()
    expect(screen.getAllByText('Dados de exemplo')).toHaveLength(4)
  })

  it('renderiza a partir de props arbitrárias', () => {
    render(
      <KpiRow
        items={[{ id: 'ordens', label: 'Ordens abertas', value: '99', trend: { value: 0, label: 'igual' } }]}
      />,
    )
    expect(screen.getByText('99')).toBeInTheDocument()
    expect(screen.getByText('Estável', { selector: '.sr-only' })).toBeInTheDocument()
  })
})

describe('RevenueChart', () => {
  const series = buildRevenueSeries(NOW)

  it('expõe resumo acessível, tabela de dados e a etiqueta', () => {
    render(<RevenueChart series={series} />)
    const chart = screen.getByRole('img', { name: /Receita diária, de .* total de R\$/ })
    expect(chart).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(31)
    expect(screen.getByText('Dados de exemplo')).toBeInTheDocument()
  })

  it('troca de série pelas abas', async () => {
    const user = userEvent.setup()
    render(<RevenueChart series={series} />)
    await user.click(screen.getByRole('tab', { name: 'Despesas' }))
    expect(screen.getByRole('img', { name: /Despesas diária/ })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Lucro' }))
    expect(screen.getByRole('img', { name: /Lucro diária/ })).toBeInTheDocument()
  })

  it('mostra a dica com dia e valor ao focar pelo teclado e navega com as setas', async () => {
    const user = userEvent.setup()
    render(<RevenueChart series={series} />)
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()
    await user.tab()
    await user.tab() // aba ativa, depois o gráfico (o painel de abas também é focável)
    const group = screen.getByRole('group', { name: /Explorar receita por dia/ })
    group.focus()
    const tip = await screen.findByTestId('chart-tooltip')
    expect(tip).toHaveTextContent(series[0].points[29].label)
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent(series[0].points[28].label)
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument()
  })
})

describe('BudgetDonuts', () => {
  it('mostra os 3 anéis com percentual', () => {
    render(<BudgetDonuts items={demoBudgets} />)
    expect(screen.getByRole('img', { name: 'Peças, orçamento usado: 37%' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Insumos/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Mão de obra/ })).toBeInTheDocument()
    expect(screen.getAllByText('Dados de exemplo')).toHaveLength(3)
  })
})

describe('JobCards', () => {
  it('mostra 4 serviços com placa, mecânico, prazo, progresso e status', () => {
    render(<JobCards items={demoJobs} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(8) // 4 do resumo + 4 ordens
    expect(screen.getByRole('img', { name: 'Placa RIO2A18' })).toBeInTheDocument()
    expect(screen.getByText('Rogério Almeida')).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(4)
    expect(screen.getAllByText('Aguardando peça')).toHaveLength(2) // resumo e cartão
    expect(screen.getByText('Dados de exemplo')).toBeInTheDocument()
  })
})

describe('TodayAgenda', () => {
  it('mostra 7 dias com hoje marcado e 4 agendamentos', () => {
    render(<TodayAgenda days={buildAgendaDays(NOW)} items={demoAppointments} />)
    const days = within(screen.getByRole('list', { name: 'Dias da semana' })).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days.filter((day) => day.getAttribute('aria-current') === 'date')).toHaveLength(1)
    expect(screen.getByText('08:30')).toBeInTheDocument()
    expect(screen.getByText('Fernanda Lacerda')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Placa MNB8G30' })).toBeInTheDocument()
    expect(screen.getByText('Dados de exemplo')).toBeInTheDocument()
  })
})

describe('ActiveMechanics', () => {
  it('mostra especialidade, estado e horário', () => {
    render(<ActiveMechanics items={demoMechanics} />)
    expect(screen.getByText('Motor e injeção')).toBeInTheDocument()
    expect(screen.getAllByText('Em serviço', { selector: 'span[data-variant]' })).toHaveLength(2)
    expect(screen.getByText('Intervalo', { selector: 'span[data-variant]' })).toBeInTheDocument()
    expect(screen.getByText('Disponível')).toBeInTheDocument()
    expect(screen.getByText('07:45')).toBeInTheDocument()
    expect(screen.getByText('Dados de exemplo')).toBeInTheDocument()
  })
})

describe('MaintenanceAlerts', () => {
  it('expõe o estado de cada linha como texto', () => {
    render(<MaintenanceAlerts items={demoAlerts} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    const oil = rows.find((row) => within(row).queryByText('Troca de óleo vencida há 800 km'))
    expect(oil).toBeDefined()
    expect(within(oil as HTMLElement).getByText('Trocar agora')).toBeInTheDocument()
    expect(screen.getAllByText('Trocar em breve')).toHaveLength(2)
    expect(screen.getByText('Ok')).toBeInTheDocument()
    expect(screen.getByText('Estoque crítico: filtro de ar')).toBeInTheDocument()
    expect(screen.getByText('Dados de exemplo')).toBeInTheDocument()
  })
})

describe('VehicleTimeline', () => {
  it('mostra o veículo, o próximo serviço e o histórico com valores em reais', () => {
    render(<VehicleTimeline vehicle={demoVehicle} history={demoHistory} />)
    expect(screen.getByRole('img', { name: 'Placa BRA2E19' })).toBeInTheDocument()
    expect(screen.getByText(/47\.820 km/)).toBeInTheDocument()
    expect(screen.getByText('Próximo serviço: troca de óleo em 1.200 km')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('R$ 631,26')).toBeInTheDocument()
    expect(screen.getByText('R$ 89,00')).toBeInTheDocument()
    expect(screen.getByText('Dados de exemplo')).toBeInTheDocument()
  })
})
