import { getToken } from '../../features/auth/storage'
import { networkError, parseErrorResponse } from './errors'

export const API_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://127.0.0.1:8000/api/v1'
).replace(/\/+$/, '')

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/** O AuthProvider registra aqui o que fazer quando uma chamada autenticada recebe 401. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export interface RequestOptions {
  method?: string
  body?: unknown
  /** false para rotas públicas (login): não envia token e 401 não derruba a sessão. */
  auth?: boolean
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options
  const token = auth ? getToken() : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw networkError()
  }

  if (!response.ok) {
    if (response.status === 401 && token && getToken() === token) unauthorizedHandler?.()
    throw await parseErrorResponse(response)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
