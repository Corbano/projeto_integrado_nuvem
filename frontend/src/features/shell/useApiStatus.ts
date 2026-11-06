import { useQuery } from '@tanstack/react-query'
import { API_ORIGIN } from '../../shared/api/client'

export type ApiStatus = 'checking' | 'online' | 'offline'

/** Consulta GET {origem da API}/health (rota pública, fora de /api/v1). Qualquer falha vira "offline". */
async function checkHealth(signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${API_ORIGIN}/health`, { headers: { Accept: 'application/json' }, signal })
    return response.ok
  } catch {
    return false
  }
}

export function useApiStatus(): ApiStatus {
  const query = useQuery({
    queryKey: ['api-health'],
    queryFn: ({ signal }) => checkHealth(signal),
    refetchInterval: 30_000,
    retry: false,
  })
  if (query.data === undefined) return 'checking'
  return query.data ? 'online' : 'offline'
}
