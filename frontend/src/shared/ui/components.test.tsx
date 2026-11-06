import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  AVATAR_TONES,
  Avatar,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DonutProgress,
  FilterBar,
  ProgressBar,
  SampleDataTag,
  SearchInput,
  StatCard,
  Tabs,
  avatarTone,
  initials,
} from '.'

function luminance(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const tokensCss = readFileSync(resolve(__dirname, '../../styles/tokens.css'), 'utf-8')

/** Resolve 'var(--color-x)' para o hex definido em tokens.css. */
function tokenHex(value: string): string {
  const name = value.match(/^var\((--[\w-]+)\)$/)?.[1]
  const hex = name && tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`))?.[1]
  if (!hex) throw new Error(`token não resolvido: ${value}`)
  return hex
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('Card', () => {
  it('compõe cabeçalho, corpo e rodapé com título como heading', () => {
    render(
      <Card accent="menta" data-testid="card">
        <CardHeader actions={<SampleDataTag />}>
          <CardTitle>Ordens de serviço</CardTitle>
          <CardDescription>Abra, acompanhe e feche ordens.</CardDescription>
        </CardHeader>
        <CardBody>Conteúdo</CardBody>
        <CardFooter>
          <Button>Abrir ordens</Button>
        </CardFooter>
      </Card>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Ordens de serviço' })).toBeInTheDocument()
    expect(screen.getByTestId('card')).toHaveAttribute('data-accent', 'menta')
    expect(screen.getByText('Dados de exemplo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir ordens' })).toBeInTheDocument()
  })

  it('aceita outro elemento e nível de título', () => {
    render(
      <Card as="section" aria-label="Resumo">
        <CardHeader>
          <CardTitle as="h2">Resumo</CardTitle>
        </CardHeader>
      </Card>,
    )
    expect(screen.getByRole('region', { name: 'Resumo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Resumo' })).toBeInTheDocument()
  })
})

describe('Avatar', () => {
  it('mostra iniciais e expõe o nome como imagem', () => {
    render(<Avatar name="Ana Paula Souza" />)
    const avatar = screen.getByRole('img', { name: 'Ana Paula Souza' })
    expect(avatar).toHaveTextContent('AS')
  })

  it('é decorativo quando pedido', () => {
    const { container } = render(<Avatar name="Bruno" decorative />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstElementChild).toHaveTextContent('BR')
  })

  it('cor é determinística pelo nome', () => {
    expect(avatarTone('Carla Dias')).toBe(avatarTone('  carla dias '))
    expect(initials('')).toBe('?')
    const tones = new Set(['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo'].map(avatarTone))
    expect(tones.size).toBeGreaterThan(2)
  })

  it.each(AVATAR_TONES.map((t) => [t.fg, t.bg]))('texto %s sobre %s >= 4.5', (fg, bg) => {
    expect(ratio(tokenHex(fg), tokenHex(bg))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('StatCard', () => {
  it('alta boa: texto "Alta de" e tom ok', () => {
    render(
      <StatCard label="Faturamento do mês" value="R$ 25.721" trend={{ value: 12.4, label: 'vs. mês anterior' }} />,
    )
    expect(screen.getByRole('region', { name: 'Faturamento do mês' })).toBeInTheDocument()
    expect(screen.getByText('R$ 25.721')).toBeInTheDocument()
    expect(screen.getByText('Alta de 12,4%')).toHaveClass('sr-only')
    expect(screen.getByText('+12,4%')).toBeInTheDocument()
    expect(screen.getByText('vs. mês anterior')).toBeInTheDocument()
    expect(screen.getByText('+12,4%').parentElement).toHaveClass('text-ok-texto')
  })

  it('alta ruim quando positiveIsGood=false e queda descrita em texto', () => {
    const { unmount } = render(
      <StatCard label="Estoque crítico" value="7" trend={{ value: 16, positiveIsGood: false }} />,
    )
    expect(screen.getByText('Alta de 16,0%').parentElement).toHaveClass('text-critico-texto')
    unmount()
    render(<StatCard label="Ordens abertas" value="12" trend={{ value: -3.6 }} />)
    expect(screen.getByText('Queda de 3,6%')).toBeInTheDocument()
    expect(screen.getByText('−3,6%').parentElement).toHaveClass('text-critico-texto')
  })

  it('variação zero é "Estável"', () => {
    render(<StatCard label="Veículos" value="9" trend={{ value: 0 }} />)
    expect(screen.getAllByText('Estável')).toHaveLength(2)
  })
})

function TabsHarness({ onChange = () => {} }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState('hoje')
  return (
    <Tabs
      label="Período"
      value={value}
      onValueChange={(id) => {
        setValue(id)
        onChange(id)
      }}
      items={[
        { id: 'hoje', label: 'Hoje', count: 3 },
        { id: 'amanha', label: 'Amanhã' },
        { id: 'semana', label: 'Esta semana', content: <p>Painel da semana</p> },
      ]}
    >
      <p>Lista filtrada: {value}</p>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('tem tablist, aba selecionada e painel ligado à aba', () => {
    render(<TabsHarness />)
    expect(screen.getByRole('tablist', { name: 'Período' })).toBeInTheDocument()
    const hoje = screen.getByRole('tab', { name: /Hoje/ })
    expect(hoje).toHaveAttribute('aria-selected', 'true')
    expect(hoje).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Amanhã' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: /Hoje/ })).toHaveTextContent('Lista filtrada: hoje')
  })

  it('setas, Home e End movem foco e seleção (tabindex móvel)', async () => {
    const onChange = vi.fn()
    render(<TabsHarness onChange={onChange} />)
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: /Hoje/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Amanhã' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Amanhã' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Esta semana' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Painel da semana')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Hoje/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{Home}')
    expect(onChange).toHaveBeenLastCalledWith('hoje')
    await userEvent.tab()
    expect(screen.getByRole('tabpanel')).toHaveFocus()
  })

  it('clique seleciona', async () => {
    render(<TabsHarness />)
    await userEvent.click(screen.getByRole('tab', { name: 'Amanhã' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Lista filtrada: amanha')
  })
})

describe('SearchInput e FilterBar', () => {
  it('é um searchbox rotulado com dica de atalho decorativa', async () => {
    const onChange = vi.fn()
    render(
      <FilterBar label="Filtros de usuários" actions={<Button>Criar usuário</Button>}>
        <SearchInput aria-label="Buscar usuários" shortcutHint="⌘K" keyShortcuts="Meta+K" onChange={onChange} />
      </FilterBar>,
    )
    expect(screen.getByRole('group', { name: 'Filtros de usuários' })).toBeInTheDocument()
    const search = screen.getByRole('searchbox', { name: 'Buscar usuários' })
    expect(search).toHaveAttribute('aria-keyshortcuts', 'Meta+K')
    expect(screen.getByText('⌘K')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.type(search, 'ana')
    expect(onChange).toHaveBeenCalledTimes(3)
  })
})

describe('ProgressBar e DonutProgress', () => {
  it('ProgressBar expõe valor e rótulo e limita a 0–100', () => {
    render(
      <>
        <ProgressBar label="Troca de óleo" value={45} showLabel showValue />
        <ProgressBar label="Excedido" value={150} />
        <ProgressBar label="Fração" value={3} max={4} />
      </>,
    )
    const bar = screen.getByRole('progressbar', { name: 'Troca de óleo' })
    expect(bar).toHaveAttribute('aria-valuenow', '45')
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Excedido' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('progressbar', { name: 'Fração' })).toHaveAttribute('aria-valuenow', '75')
  })

  it('DonutProgress é uma imagem com rótulo e percentual', () => {
    render(<DonutProgress label="Peças" value={37} tone="menta" />)
    expect(screen.getByRole('img', { name: 'Peças: 37%' })).toBeInTheDocument()
    expect(screen.getByText('37%')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SampleDataTag', () => {
  it('mostra o texto visível', () => {
    render(<SampleDataTag />)
    expect(screen.getByText('Dados de exemplo')).toHaveAttribute('title', 'Números fictícios, só para demonstração.')
  })
})
