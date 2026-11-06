import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '../../app/App'
import { createAppRouter } from '../../app/router'
import { apiFetch, API_URL } from '../../shared/api/client'
import { ADMIN, errorBody, TEST_PASSWORD } from '../../test/handlers'
import { server } from '../../test/server'
import { AuthProvider } from './AuthProvider'
import { getToken, setToken } from './storage'
import { useAuth } from './useAuth'

function renderAt(path: string) {
  const router = createAppRouter([path])
  render(<App router={router} />)
  return router
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  if (email) await user.type(screen.getByLabelText('E-mail'), email)
  if (password) await user.type(screen.getByLabelText('Senha'), password)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('login', () => {
  it('guarda o token e vai ao destino pretendido', async () => {
    const router = renderAt('/usuarios')
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(router.state.location.pathname).toBe('/entrar')
    expect(document.title).toBe('Entrar · Auto Center')

    await fillAndSubmit('admin@teste.local', TEST_PASSWORD)
    await screen.findByRole('heading', { name: 'Usuários' })
    expect(router.state.location.pathname).toBe('/usuarios')
    expect(getToken()).toBe('token-admin')
  })

  it('senha errada mostra mensagem genérica', async () => {
    renderAt('/entrar')
    await fillAndSubmit('admin@teste.local', 'errada')
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })

  it('mostra a mensagem de rede quando a API está fora', async () => {
    server.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.error()))
    renderAt('/entrar')
    await fillAndSubmit('admin@teste.local', TEST_PASSWORD)
    expect(
      await screen.findByText('Sem conexão com o servidor. Verifique a internet e tente de novo.'),
    ).toBeInTheDocument()
  })

  it('valida os campos no cliente', async () => {
    renderAt('/entrar')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('E-mail'), 'sem-arroba')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/Informe um e-mail válido/)).toBeInTheDocument()
  })

  it('usuário já autenticado em /entrar vai para o início', async () => {
    setToken('token-admin')
    const router = renderAt('/entrar')
    await screen.findByRole('heading', { name: 'Início' })
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('sessão', () => {
  it('token inválido (401 em /auth/me) cai em /entrar', async () => {
    setToken('token-velho')
    const router = renderAt('/')
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(router.state.location.pathname).toBe('/entrar')
    expect(getToken()).toBeNull()
  })

  it('401 em chamada autenticada desloga e preserva o destino', async () => {
    server.use(
      http.get(`${API_URL}/protegido`, () =>
        HttpResponse.json(errorBody('authentication_failed', 'Token expirado'), { status: 401 }),
      ),
    )
    setToken('token-admin')
    const router = renderAt('/usuarios')
    await screen.findByRole('heading', { name: 'Usuários' })

    await act(async () => {
      await apiFetch('/protegido').catch(() => undefined)
    })
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(router.state.location.pathname).toBe('/entrar')
    expect(router.state.location.state).toMatchObject({ from: '/usuarios' })
    expect(getToken()).toBeNull()
  })

  it('RequireRole bloqueia mecânico em /usuarios', async () => {
    setToken('token-mecanico')
    renderAt('/usuarios')
    await screen.findByRole('heading', { name: 'Sem permissão' })
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })

  it('logout limpa o armazenamento e volta a /entrar', async () => {
    setToken('token-admin')
    const router = renderAt('/')
    await screen.findByText(`Olá, ${ADMIN.name}.`)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }))
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(getToken()).toBeNull()
    expect(router.state.location.pathname).toBe('/entrar')
    await waitFor(() => expect(router.state.location.state).toEqual({}))
  })

  it('rota desconhecida mostra página não encontrada', async () => {
    renderAt('/nada')
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
  })
})

function Probe() {
  const { status, login, logout } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <button type="button" onClick={logout}>
        probe-logout
      </button>
      <button type="button" onClick={() => void login('admin@teste.local', TEST_PASSWORD)}>
        probe-login
      </button>
    </div>
  )
}

function gate() {
  let release: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('corridas de sessão', () => {
  it('/auth/me que resolve depois do logout não reautentica', async () => {
    const g = gate()
    server.use(
      http.get(`${API_URL}/auth/me`, async () => {
        await g.promise
        return HttpResponse.json(ADMIN)
      }),
    )
    setToken('token-admin')
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await userEvent.setup().click(screen.getByRole('button', { name: 'probe-logout' }))
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    g.release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    expect(getToken()).toBeNull()
  })

  it('401 tardio do /auth/me inicial não derruba um login mais novo', async () => {
    const g = gate()
    server.use(
      http.get(`${API_URL}/auth/me`, async ({ request }) => {
        if (request.headers.get('Authorization') !== 'Bearer token-velho') return undefined
        await g.promise
        return HttpResponse.json(errorBody('authentication_failed', 'Token inválido'), { status: 401 })
      }),
    )
    setToken('token-velho')
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'probe-login' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    g.release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(getToken()).toBe('token-admin')
  })

  it('500 no /auth/me inicial mantém o token e não diz que a sessão terminou', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json(errorBody('internal_error', 'Erro interno'), { status: 500 }),
      ),
    )
    setToken('token-admin')
    renderAt('/')
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(getToken()).toBe('token-admin')
    expect(screen.queryByText(/sessão terminou/)).not.toBeInTheDocument()
  })

  it('500 no login mostra a mensagem genérica, não a de credenciais', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(errorBody('internal_error', 'Erro interno'), { status: 500 }),
      ),
    )
    renderAt('/entrar')
    await fillAndSubmit('admin@teste.local', TEST_PASSWORD)
    expect(await screen.findByText(/Não foi possível entrar agora/)).toBeInTheDocument()
    expect(screen.queryByText('E-mail ou senha incorretos.')).not.toBeInTheDocument()
  })
})
