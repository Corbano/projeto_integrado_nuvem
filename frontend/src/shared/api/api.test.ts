import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/server'
import { API_URL, apiFetch, setUnauthorizedHandler } from './client'
import { ApiError, NETWORK_ERROR_MESSAGE } from './errors'
import { setToken } from '../../features/auth/storage'

describe('apiFetch', () => {
  it('converte o envelope de erro em ApiError', async () => {
    server.use(
      http.get(`${API_URL}/x`, () =>
        HttpResponse.json(
          { error: { code: 'validation_error', message: 'Dados inválidos', details: [{ loc: ['body', 'email'], msg: 'inválido', type: 'value_error' }] } },
          { status: 422 },
        ),
      ),
    )
    const error = await apiFetch('/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const api = error as ApiError
    expect(api.status).toBe(422)
    expect(api.code).toBe('validation_error')
    expect(api.message).toBe('Dados inválidos')
    expect(api.details?.[0].loc).toEqual(['body', 'email'])
  })

  it('tolera corpo de erro fora do padrão', async () => {
    server.use(http.get(`${API_URL}/x`, () => new HttpResponse('boom', { status: 500 })))
    const error = (await apiFetch('/x').catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(500)
    expect(error.code).toBe('http_error')
  })

  it('falha de rede vira ApiError network_error', async () => {
    server.use(http.get(`${API_URL}/x`, () => HttpResponse.error()))
    const error = (await apiFetch('/x').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('network_error')
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('envia o token Bearer e aciona o callback em 401 autenticado', async () => {
    let auth: string | null = null
    server.use(
      http.get(`${API_URL}/x`, ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ error: { code: 'authentication_failed', message: 'x' } }, { status: 401 })
      }),
    )
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    setToken('abc')
    await apiFetch('/x').catch(() => undefined)
    setUnauthorizedHandler(null)
    expect(auth).toBe('Bearer abc')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('401 em rota pública não aciona o callback', async () => {
    server.use(
      http.post(`${API_URL}/x`, () =>
        HttpResponse.json({ error: { code: 'authentication_failed', message: 'x' } }, { status: 401 }),
      ),
    )
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    setToken('abc')
    await apiFetch('/x', { method: 'POST', auth: false }).catch(() => undefined)
    setUnauthorizedHandler(null)
    expect(handler).not.toHaveBeenCalled()
  })

  it('204 com noContent devolve undefined', async () => {
    server.use(http.delete(`${API_URL}/x`, () => new HttpResponse(null, { status: 204 })))
    await expect(apiFetch('/x', { method: 'DELETE', noContent: true })).resolves.toBeUndefined()
  })

  it('200 com corpo vazio ou não-JSON vira invalid_response', async () => {
    server.use(http.get(`${API_URL}/x`, () => new HttpResponse('<html>', { status: 200 })))
    const error = (await apiFetch('/x').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(200)
    expect(error.code).toBe('invalid_response')
    expect(error.message).toBe('Resposta inesperada do servidor.')
  })
})
