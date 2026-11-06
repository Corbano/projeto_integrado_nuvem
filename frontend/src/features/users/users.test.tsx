import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { createAppRouter } from '../../app/router'
import { API_URL } from '../../shared/api/client'
import { errorBody, resetUsers, usersDb, usersRequests } from '../../test/handlers'
import { server } from '../../test/server'
import { setToken } from '../auth/storage'

function renderUsers(token = 'token-admin') {
  setToken(token)
  render(<App router={createAppRouter(['/usuarios'])} />)
}

function mockViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query)
      return {
        matches: max ? width <= Number(max[1]) : false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }
    }),
  )
}

async function ready() {
  await screen.findByRole('table', { name: 'Usuários' })
}

function row(name: string) {
  return screen.getByRole('row', { name: new RegExp(name) })
}

async function openMenu(name: string, item: string) {
  await userEvent.click(screen.getByRole('button', { name: `Ações de ${name}` }))
  await userEvent.click(await screen.findByRole('menuitem', { name: item }))
}

beforeEach(() => resetUsers())
afterEach(() => vi.unstubAllGlobals())

describe('Usuários: lista', () => {
  it('mostra a tabela com perfil, estado, resumo e título da aba', async () => {
    renderUsers()
    await ready()
    expect(document.title).toBe('Usuários · Auto Center')
    expect(screen.getByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(11) // cabeçalho + 10
    expect(within(row('Ana Souza')).getByText('Recepção')).toBeInTheDocument()
    expect(within(row('Ana Souza')).getByText('Ativo')).toBeInTheDocument()
    expect(within(row('Ana Admin')).getByText('Administrador')).toBeInTheDocument()
    expect(within(row('Ana Admin')).getByText('Você')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1–10 de 25 usuários')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    // Sem ordenação de fachada: a API não ordena.
    expect(screen.queryByRole('columnheader', { name: /Nome/ })?.querySelector('button')).toBeNull()
  })

  it('a busca espera 300 ms, envia q uma vez e volta para a página 1', async () => {
    renderUsers()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Mostrando 11–20 de 25 usuários')
    usersRequests.length = 0

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar usuários' }), 'souza')
    expect(usersRequests).toHaveLength(0)
    await screen.findByText('Mostrando 1–1 de 1 usuário')
    expect(usersRequests).toHaveLength(1)
    expect(usersRequests[0].searchParams.get('q')).toBe('souza')
    expect(usersRequests[0].searchParams.get('page')).toBe('1')
  })

  it('pagina e troca as linhas por página', async () => {
    renderUsers()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(await screen.findByText('Mostrando 11–20 de 25 usuários')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Linhas por página'), '20')
    expect(await screen.findByText('Mostrando 1–20 de 25 usuários')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    expect(usersRequests.at(-1)?.searchParams.get('size')).toBe('20')
  })

  it('estado vazio com ação e botão para limpar a busca', async () => {
    renderUsers()
    await ready()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar usuários' }), 'zzzz')
    expect(await screen.findByText('Nenhum usuário encontrado')).toBeInTheDocument()
    expect(screen.getByText('Limpe a busca ou crie um novo usuário.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
    await ready()
    expect(screen.getByRole('searchbox', { name: 'Buscar usuários' })).toHaveValue('')
  })

  it('erro de carregamento oferece "Tentar de novo"', async () => {
    server.use(
      http.get(`${API_URL}/users`, () => HttpResponse.json(errorBody('forbidden', 'Acesso negado'), { status: 403 }), {
        once: true,
      }),
    )
    renderUsers()
    expect(await screen.findByText('Não foi possível carregar os usuários')).toBeInTheDocument()
    expect(screen.getByText('Acesso negado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await ready()
  })

  it('perfil sem permissão não chega à página', async () => {
    renderUsers('token-recepcao')
    expect(await screen.findByText('Seu perfil não tem acesso a esta página')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo usuário' })).not.toBeInTheDocument()
  })
})

describe('Usuários: criar', () => {
  async function fillCreate(email = 'novo@teste.local', password = 'Senha#Forte123') {
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' })
    await userEvent.type(within(dialog).getByLabelText(/^Nome/), 'Novo Colega')
    await userEvent.type(within(dialog).getByLabelText(/^E-mail/), email)
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Perfil/), 'mechanic')
    await userEvent.type(within(dialog).getByLabelText(/^Senha/), password)
    return dialog
  }

  it('cria, avisa com "Usuário criado" e atualiza a lista', async () => {
    renderUsers()
    await ready()
    const dialog = await fillCreate()
    expect(within(dialog).getByText('Força: Forte')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))
    expect(await screen.findByText('Usuário criado')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(usersDb.some((u) => u.email === 'novo@teste.local' && u.role === 'mechanic')).toBe(true)
    expect(await screen.findByText('Mostrando 1–10 de 26 usuários')).toBeInTheDocument()
  })

  it('campos do e-mail e da senha usam teclado e preenchimento corretos', async () => {
    renderUsers()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    const dialog = await screen.findByRole('dialog')
    const email = within(dialog).getByLabelText(/^E-mail/)
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('inputmode', 'email')
    expect(email).toHaveAttribute('autocomplete', 'off')
    expect(within(dialog).getByLabelText(/^Senha/)).toHaveAttribute('autocomplete', 'new-password')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mostrar senha' }))
    expect(within(dialog).getByLabelText(/^Senha/)).toHaveAttribute('type', 'text')
  })

  it('valida no cliente antes de enviar', async () => {
    renderUsers()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^E-mail/), 'sem-arroba')
    await userEvent.type(within(dialog).getByLabelText(/^Senha/), 'curta')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))
    expect(within(dialog).getByText('Informe o nome.')).toBeInTheDocument()
    expect(within(dialog).getByText(/e-mail válido/)).toBeInTheDocument()
    expect(within(dialog).getByText('A senha deve ter de 8 a 72 caracteres.')).toBeInTheDocument()
    expect(usersDb).toHaveLength(25)
  })

  it('e-mail duplicado (409) aparece sob o campo de e-mail', async () => {
    renderUsers()
    await ready()
    const dialog = await fillCreate('ana.souza@teste.local')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/^E-mail/)).toHaveAccessibleDescription(/E-mail já cadastrado/),
    )
    expect(within(dialog).getByLabelText(/^E-mail/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('erros 422 do servidor vão para os campos; o que não for de campo vai ao topo', async () => {
    server.use(
      http.post(`${API_URL}/users`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_error',
              message: 'Dados inválidos',
              details: [
                { loc: ['body', 'password'], msg: 'Senha comum demais', type: 'value_error' },
                { loc: ['body'], msg: 'Combinação não permitida', type: 'value_error' },
              ],
            },
          },
          { status: 422 },
        ),
      ),
    )
    renderUsers()
    await ready()
    const dialog = await fillCreate()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }))
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/^Senha/)).toHaveAccessibleDescription(/Senha comum demais/),
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Combinação não permitida')
  })
})

describe('Usuários: editar, desativar, excluir', () => {
  it('edita o perfil e mostra "Usuário atualizado"', async () => {
    renderUsers()
    await ready()
    await openMenu('Ana Souza', 'Editar')
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuário' })
    expect(within(dialog).getByLabelText(/^E-mail/)).toBeDisabled()
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Perfil/), 'admin')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Usuário atualizado')).toBeInTheDocument()
    await waitFor(() => expect(within(row('Ana Souza')).getByText('Administrador')).toBeInTheDocument())
  })

  it('desativar pede confirmação e só então muda o estado', async () => {
    renderUsers()
    await ready()
    await openMenu('Ana Souza', 'Desativar')
    const dialog = await screen.findByRole('dialog', { name: 'Desativar usuário?' })
    expect(usersDb.find((u) => u.id === 4)?.active).toBe(true)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }))
    expect(await screen.findByText('Usuário desativado')).toBeInTheDocument()
    await waitFor(() => expect(within(row('Ana Souza')).getByText('Inativo')).toBeInTheDocument())
    // e o menu passa a oferecer "Ativar"
    await openMenu('Ana Souza', 'Ativar')
    expect(await screen.findByText('Usuário ativado')).toBeInTheDocument()
  })

  it('excluir pede confirmação com o nome e remove a linha', async () => {
    renderUsers()
    await ready()
    await openMenu('Ana Souza', 'Excluir')
    const dialog = await screen.findByRole('dialog', { name: 'Excluir usuário?' })
    expect(dialog).toHaveTextContent('Ana Souza perderá o acesso. Esta ação não pode ser desfeita.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(usersDb.some((u) => u.id === 4)).toBe(true)

    await openMenu('Ana Souza', 'Excluir')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Usuário excluído')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('row', { name: /Ana Souza/ })).not.toBeInTheDocument())
  })

  it('a própria linha não permite excluir nem desativar, com explicação', async () => {
    renderUsers()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Ações de Ana Admin' }))
    const del = await screen.findByRole('menuitem', { name: 'Excluir' })
    const off = screen.getByRole('menuitem', { name: 'Desativar' })
    expect(del).toHaveAttribute('aria-disabled', 'true')
    expect(off).toHaveAttribute('aria-disabled', 'true')
    expect(del).toHaveAccessibleDescription('Você não pode se excluir.')
    await userEvent.click(del)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuário' })
    expect(within(dialog).getByLabelText(/^Perfil/)).toBeDisabled()
    expect(within(dialog).getByRole('switch', { name: 'Usuário ativo' })).toBeDisabled()
    expect(within(dialog).getAllByText(/Você não pode alterar o próprio perfil/).length).toBeGreaterThan(0)
  })

  it('regra de negócio do servidor (422) aparece no topo do diálogo de edição', async () => {
    server.use(
      http.patch(`${API_URL}/users/:id`, () =>
        HttpResponse.json(errorBody('business_rule', 'Este é o último administrador ativo'), { status: 422 }),
      ),
    )
    renderUsers()
    await ready()
    await openMenu('Mário Mecânico', 'Editar')
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuário' })
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Perfil/), 'reception')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este é o último administrador ativo')
  })

  it('erro do servidor ao excluir fica visível dentro da confirmação', async () => {
    server.use(
      http.delete(`${API_URL}/users/:id`, () =>
        HttpResponse.json(errorBody('business_rule', 'Você não pode excluir a si mesmo'), { status: 422 }),
      ),
    )
    renderUsers()
    await ready()
    await openMenu('Ana Souza', 'Excluir')
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Você não pode excluir a si mesmo')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Usuários: celular', () => {
  it('abaixo de 768 px a tabela vira lista de cards, com menu de 44 px', async () => {
    mockViewport(390)
    renderUsers()
    const list = await screen.findByRole('list', { name: 'Usuários' })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(10)
    const card = items.find((item) => within(item).queryByText('Ana Souza'))!
    expect(within(card).getByText('ana.souza@teste.local')).toBeInTheDocument()
    expect(within(card).getByText('Recepção')).toBeInTheDocument()
    expect(within(card).getByText('Ativo')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Ações de Ana Souza' })).toHaveClass('size-11!')
  })

  it('abaixo de 640 px o formulário abre como bottom sheet', async () => {
    mockViewport(390)
    renderUsers()
    await screen.findByRole('list', { name: 'Usuários' })
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    expect(await screen.findByRole('dialog', { name: 'Novo usuário' })).toHaveAttribute('data-variant', 'sheet')
  })

  it('em tablet (768 px) mantém a tabela e o diálogo centralizado', async () => {
    mockViewport(800)
    renderUsers()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    expect(await screen.findByRole('dialog', { name: 'Novo usuário' })).toHaveAttribute('data-variant', 'center')
  })
})
