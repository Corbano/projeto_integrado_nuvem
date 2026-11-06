import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { createAppRouter } from '../../app/router'
import { API_ORIGIN } from '../../shared/api/client'
import { server } from '../../test/server'
import { setToken } from '../auth/storage'
import { SIDEBAR_STORAGE_KEY } from './AppShell'
import { greetingFor } from './greeting'
import { MODULES, modulesForRole } from './modules'

const TITLES = [
  'Usuários',
  'Clientes',
  'Veículos',
  'Check-in',
  'Ordens de serviço',
  'Estoque',
  'Financeiro',
  'Alertas de manutenção',
]

function renderAt(path: string, token = 'token-admin') {
  setToken(token)
  const router = createAppRouter([path])
  render(<App router={router} />)
  return router
}

function mockViewport(mobile: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: mobile && query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  )
}

async function cards() {
  return await screen.findAllByRole('article')
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

describe('Início', () => {
  it('admin vê os 8 cards e as entradas da barra lateral', async () => {
    renderAt('/')
    expect(await cards()).toHaveLength(8)
    for (const title of TITLES) {
      const card = screen.getAllByRole('heading', { level: 3, name: title }).find((h) => h.closest('article'))
      expect(card).toBeDefined()
    }
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/usuarios')
    expect(within(nav).getByText('Administração')).toBeInTheDocument()
    expect(within(nav).getByText('Operação')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Usuários' })).toHaveAttribute('href', '/usuarios')
  })

  it('mostra a visão geral com dados de exemplo, cada card com a etiqueta', async () => {
    renderAt('/')
    await cards()
    const overview = screen.getByRole('region', { name: 'Visão geral da oficina' })
    const sections = within(overview).getAllByRole('region')
    // 4 KPIs + gráfico, 3 anéis, serviços, veículo, agenda, alertas, mecânicos
    expect(sections).toHaveLength(13)
    for (const section of sections) {
      expect(within((section.closest('li') as HTMLElement | null) ?? section).getAllByText('Dados de exemplo').length).toBeGreaterThan(0)
    }
    expect(within(overview).getByRole('heading', { level: 3, name: 'Alertas de manutenção' })).toBeInTheDocument()
    expect(within(overview).getByRole('heading', { level: 3, name: 'Serviços em andamento' })).toBeInTheDocument()
    expect(within(overview).getByRole('heading', { level: 3, name: 'Agenda de hoje' })).toBeInTheDocument()
    expect(await cards()).toHaveLength(8)
  })

  it('recepção vê só o permitido, sem Usuários', async () => {
    renderAt('/', 'token-recepcao')
    await cards()
    const titles = (await cards()).map((card) => within(card).getByRole('heading', { level: 3 }).textContent)
    expect(titles).toEqual(['Clientes', 'Veículos', 'Check-in', 'Ordens de serviço', 'Estoque', 'Alertas de manutenção'])
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).queryByText('Usuários')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Financeiro')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Administração')).not.toBeInTheDocument()
  })

  it('só o módulo concluído mostra a barra azul embaixo e a etiqueta "Concluído"', async () => {
    renderAt('/')
    await cards()
    const usuarios = screen.getByRole('heading', { level: 3, name: 'Usuários' }).closest('article')!
    expect(within(usuarios).getByText('Concluído')).toBeInTheDocument()
    expect(within(usuarios).getByTestId('modulo-concluido-barra')).toBeInTheDocument()
    const clientes = screen.getByRole('heading', { level: 3, name: 'Clientes' }).closest('article')!
    expect(within(clientes).queryByText('Concluído')).not.toBeInTheDocument()
    expect(within(clientes).queryByTestId('modulo-concluido-barra')).not.toBeInTheDocument()
    expect(screen.getAllByText('Concluído')).toHaveLength(MODULES.filter((m) => m.available).length)
  })

  it('o resumo conta os módulos concluídos do perfil (admin vê 8)', async () => {
    renderAt('/')
    await cards()
    const done = MODULES.filter((m) => m.available).length
    expect(screen.getByTestId('resumo-modulos')).toHaveTextContent(`${done} de 8 módulos concluídos`)
    const bar = screen.getByRole('progressbar', { name: `${done} de 8 módulos concluídos` })
    expect(bar).toHaveAttribute('aria-valuenow', String(Math.round((done / 8) * 100)))
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('o resumo da recepção conta só os 6 módulos que ela vê', async () => {
    renderAt('/', 'token-recepcao')
    await cards()
    const done = modulesForRole('reception').filter((m) => m.available).length
    expect(screen.getByTestId('resumo-modulos')).toHaveTextContent(`${done} de 6 módulos concluídos`)
  })

  it('módulos indisponíveis não são links nem entram na ordem de tabulação', async () => {
    renderAt('/')
    await cards()
    const clientes = screen.getByRole('heading', { level: 3, name: 'Clientes' }).closest('article')!
    expect(within(clientes).queryByRole('link')).not.toBeInTheDocument()
    const button = within(clientes).getByRole('button', { name: 'Em breve' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('tabindex', '-1')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    const disabled = within(nav).getByTitle('Clientes (em breve)')
    expect(disabled).toHaveAttribute('aria-disabled', 'true')
    expect(disabled).not.toHaveAttribute('href')
    expect(disabled).not.toHaveAttribute('tabindex')
  })

  it('saudação muda com o horário', async () => {
    expect(greetingFor(new Date(2026, 0, 1, 9))).toBe('Bom dia')
    expect(greetingFor(new Date(2026, 0, 1, 15))).toBe('Boa tarde')
    expect(greetingFor(new Date(2026, 0, 1, 21))).toBe('Boa noite')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 1, 15, 0))
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Boa tarde, Ana' })).toBeInTheDocument()
  })

  it('mostra API online conforme o /health', async () => {
    renderAt('/')
    expect(await screen.findByText('API online')).toBeInTheDocument()
  })

  it('mostra API offline quando o /health falha', async () => {
    server.use(http.get(`${API_ORIGIN}/health`, () => HttpResponse.error()))
    renderAt('/')
    expect(await screen.findByText('API offline')).toBeInTheDocument()
  })

  it('define o título do documento', async () => {
    renderAt('/')
    await cards()
    expect(document.title).toBe('Início · Auto Center')
  })
})

describe('páginas dentro do shell', () => {
  it('não encontrada renderiza dentro do shell', async () => {
    renderAt('/nada')
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('mecânico em /usuarios vê Sem permissão com o menu', async () => {
    renderAt('/usuarios', 'token-mecanico')
    expect(await screen.findByRole('heading', { level: 1, name: 'Sem permissão' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('/usuarios mostra o cabeçalho e o breadcrumb', async () => {
    renderAt('/usuarios')
    expect(await screen.findByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument()
    const crumb = screen.getByRole('navigation', { name: 'Você está em' })
    expect(within(crumb).getByText('Início')).toBeInTheDocument()
    expect(within(crumb).getByText('Usuários')).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Usuários · Auto Center')
  })
})

describe('paleta de comandos', () => {
  it('Ctrl+K abre, filtra e Enter navega para módulo disponível', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    await cards()
    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('combobox', { name: 'Buscar funcionalidade' })
    expect(input).toHaveFocus()
    await user.type(input, 'usu')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/usuarios'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('módulos indisponíveis ficam desabilitados e não podem ser escolhidos', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    await cards()
    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('combobox', { name: 'Buscar funcionalidade' })
    await user.type(input, 'clientes')
    const option = screen.getByRole('option', { name: /Clientes/ })
    expect(option).toHaveAttribute('aria-disabled', 'true')
    expect(option).toHaveAttribute('aria-selected', 'false')
    await user.keyboard('{Enter}')
    await user.click(option)
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('setas movem a seleção e Esc fecha devolvendo o foco', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await cards()
    const search = screen.getByRole('searchbox', { name: 'Buscar funcionalidade' })
    await user.click(search)
    const input = await screen.findByRole('combobox')
    const selected = () => screen.getByRole('option', { selected: true }).textContent
    expect(selected()).toContain('Início')
    await user.keyboard('{ArrowDown}')
    expect(selected()).toContain('Usuários')
    await user.keyboard('{ArrowDown}')
    expect(selected()).toContain('Início')
    expect(input).toHaveAttribute('aria-activedescendant')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(search).toHaveFocus()
  })
})

describe('barra lateral', () => {
  it('recolher persiste no localStorage', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await cards()
    await user.click(screen.getByRole('button', { name: 'Recolher menu' }))
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('1')
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument()
    expect(screen.queryByText('Administração')).not.toBeInTheDocument()
  })

  it('começa recolhida quando a preferência está salva', async () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, '1')
    renderAt('/')
    await cards()
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument()
  })

  it('em tela pequena a gaveta abre, fecha com Esc e devolve o foco', async () => {
    mockViewport(true)
    const user = userEvent.setup()
    renderAt('/')
    await cards()
    const toggle = screen.getByRole('button', { name: 'Abrir menu' })
    const aside = document.getElementById('menu-principal')!
    expect(aside).toHaveAttribute('inert')
    await user.click(toggle)
    await waitFor(() => expect(aside).not.toHaveAttribute('inert'))
    expect(aside.contains(document.activeElement)).toBe(true)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(aside).toHaveAttribute('inert'))
    expect(toggle).toHaveFocus()
  })

  it('a gaveta fecha ao escolher um destino', async () => {
    mockViewport(true)
    const user = userEvent.setup()
    const router = renderAt('/')
    await cards()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    await user.click(within(nav).getByRole('link', { name: 'Usuários' }))
    expect(router.state.location.pathname).toBe('/usuarios')
    expect(document.getElementById('menu-principal')).toHaveAttribute('inert')
  })
})

describe('topo', () => {
  it('sino mostra aviso vazio e Esc devolve o foco', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await cards()
    const bell = screen.getByRole('button', { name: 'Notificações' })
    await user.click(bell)
    expect(screen.getByText('Nenhum aviso por enquanto.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Nenhum aviso por enquanto.')).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('menu do usuário tem Sair', async () => {
    const user = userEvent.setup()
    const router = renderAt('/')
    await cards()
    await user.click(screen.getByRole('button', { name: 'Menu do usuário' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }))
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('tem link para pular ao conteúdo', async () => {
    renderAt('/')
    await cards()
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#conteudo')
  })
})
