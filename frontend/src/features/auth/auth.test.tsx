import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '../../app/App'
import { createAppRouter } from '../../app/router'
import { apiFetch, API_URL } from '../../shared/api/client'
import { ADMIN, errorBody, TEST_PASSWORD } from '../../test/handlers'
import { server } from '../../test/server'
import { getToken, setToken } from './storage'

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
