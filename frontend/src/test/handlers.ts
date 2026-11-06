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

export const handlers = [
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
