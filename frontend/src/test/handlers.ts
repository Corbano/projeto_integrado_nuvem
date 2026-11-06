import { http, HttpResponse } from 'msw'
import { API_ORIGIN, API_URL } from '../shared/api/client'
import type { User } from '../shared/api/types'

export const ADMIN: User = { id: 1, name: 'Ana Admin', email: 'admin@teste.local', role: 'admin', active: true }
export const MECHANIC: User = {
  id: 2,
  name: 'Mário Mecânico',
  email: 'mecanico@teste.local',
  role: 'mechanic',
  active: true,
}
export const RECEPTION: User = {
  id: 3,
  name: 'Rita Recepção',
  email: 'recepcao@teste.local',
  role: 'reception',
  active: true,
}
export const TEST_PASSWORD = 'senha-de-teste-123'

const usersByToken: Record<string, User> = { 'token-admin': ADMIN, 'token-mecanico': MECHANIC, 'token-recepcao': RECEPTION }

export function errorBody(code: string, message: string) {
  return { error: { code, message } }
}

/** Banco de usuários em memória para as telas de gestão (reiniciado com resetUsers()). */
export const ANA: User = { id: 4, name: 'Ana Souza', email: 'ana.souza@teste.local', role: 'reception', active: true }
export let usersDb: User[] = []
export const usersRequests: URL[] = []
let nextUserId = 100

export function resetUsers(extra = 21) {
  nextUserId = 100
  usersRequests.length = 0
  const filler = Array.from({ length: extra }, (_, i): User => {
    const n = String(i + 5).padStart(2, '0')
    return { id: i + 5, name: `Pessoa ${n}`, email: `pessoa${n}@teste.local`, role: 'mechanic', active: true }
  })
  usersDb = [ADMIN, MECHANIC, RECEPTION, ANA, ...filler].map((u) => ({ ...u }))
}
resetUsers()

function ruleViolation(message: string) {
  return HttpResponse.json(errorBody('business_rule', message), { status: 422 })
}

export const handlers = [
  http.get(`${API_URL}/users`, ({ request }) => {
    const url = new URL(request.url)
    usersRequests.push(url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const size = Number(url.searchParams.get('size') ?? 10)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const found = usersDb.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    return HttpResponse.json({ items: found.slice((page - 1) * size, page * size), total: found.length, page, size })
  }),
  http.post(`${API_URL}/users`, async ({ request }) => {
    const body = (await request.json()) as { name: string; email: string; password: string; role: User['role'] }
    if (usersDb.some((u) => u.email === body.email)) {
      return HttpResponse.json(errorBody('conflict', 'E-mail já cadastrado'), { status: 409 })
    }
    const created: User = { id: nextUserId++, name: body.name, email: body.email, role: body.role, active: true }
    usersDb.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.patch(`${API_URL}/users/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<User>
    const target = usersDb.find((u) => String(u.id) === params.id)
    if (!target) return HttpResponse.json(errorBody('not_found', 'Usuário não encontrado'), { status: 404 })
    if (target.id === ADMIN.id && (body.active === false || (body.role && body.role !== 'admin'))) {
      return ruleViolation('Você não pode desativar nem rebaixar a si mesmo')
    }
    Object.assign(target, { name: body.name ?? target.name, role: body.role ?? target.role, active: body.active ?? target.active })
    return HttpResponse.json(target)
  }),
  http.delete(`${API_URL}/users/:id`, ({ params }) => {
    const target = usersDb.find((u) => String(u.id) === params.id)
    if (!target) return HttpResponse.json(errorBody('not_found', 'Usuário não encontrado'), { status: 404 })
    if (target.id === ADMIN.id) return ruleViolation('Você não pode excluir a si mesmo')
    usersDb = usersDb.filter((u) => u !== target)
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${API_ORIGIN}/health`, () => HttpResponse.json({ status: 'ok' })),
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }
    const user = [ADMIN, MECHANIC].find((u) => u.email === email)
    if (!user || password !== TEST_PASSWORD) {
      return HttpResponse.json(errorBody('authentication_failed', 'Credenciais inválidas'), { status: 401 })
    }
    const access_token = user.role === 'admin' ? 'token-admin' : 'token-mecanico'
    return HttpResponse.json({ access_token, token_type: 'bearer' })
  }),
  http.get(`${API_URL}/auth/me`, ({ request }) => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const user = usersByToken[token]
    if (!user) return HttpResponse.json(errorBody('authentication_failed', 'Token inválido'), { status: 401 })
    return HttpResponse.json(user)
  }),
]
