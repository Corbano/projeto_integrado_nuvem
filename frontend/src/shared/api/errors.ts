import type { ApiErrorBody, ApiErrorDetail } from './types'

export const NETWORK_ERROR_MESSAGE = 'Sem conexão com o servidor. Verifique a internet e tente de novo.'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: ApiErrorDetail[]

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function networkError(): ApiError {
  return new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE)
}

/** Converte uma resposta de erro (envelope {"error": {...}}) em ApiError; tolera corpo ausente ou fora do padrão. */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    body = null
  }
  const error = body?.error
  return new ApiError(
    response.status,
    error?.code ?? 'http_error',
    error?.message ?? 'Não foi possível concluir a operação. Tente de novo.',
    error?.details,
  )
}
