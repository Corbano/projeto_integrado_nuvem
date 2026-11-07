import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../shared/api/client'
import { ApiError } from '../../shared/api/errors'
import { FUEL_LABELS } from '../customers/api'
import type { Fuel } from '../customers/api'

export { FUEL_LABELS }
export type { Fuel }
export const FUELS = Object.keys(FUEL_LABELS) as Fuel[]

export interface Vehicle {
  id: number
  customer_id: number
  plate: string
  brand: string
  model: string
  year: number
  engine: string | null
  fuel: Fuel
  color: string
  chassis: string | null
  renavam: string | null
  current_km: number
}

export interface VehicleDetail extends Vehicle {
  customer: { id: number; name: string } | null
}

export interface VehicleList {
  items: Vehicle[]
  total: number
  page: number
  size: number
}

export interface ListVehiclesParams {
  page: number
  size: number
  q: string
  customerId?: number | null
}

export interface CreateVehicleInput {
  customer_id: number
  plate: string
  brand: string
  model: string
  year: number
  engine?: string | null
  fuel: Fuel
  color: string
  chassis?: string | null
  renavam?: string | null
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>

export function listVehicles({ page, size, q, customerId }: ListVehiclesParams, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(page), size: String(size) })
  if (q.trim()) query.set('q', q.trim())
  if (customerId) query.set('customer_id', String(customerId))
  return apiFetch<VehicleList>(`/vehicles?${query.toString()}`, { signal })
}

export function getVehicle(id: number | string, signal?: AbortSignal) {
  return apiFetch<VehicleDetail>(`/vehicles/${id}`, { signal })
}

const KEY = ['vehicles'] as const

export function useVehicles(params: ListVehiclesParams) {
  return useQuery({
    queryKey: [...KEY, 'list', params],
    queryFn: ({ signal }) => listVehicles(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useVehicle(id: number | string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', String(id)],
    queryFn: ({ signal }) => getVehicle(id as number | string, signal),
    enabled: id !== null && id !== undefined && String(id) !== '',
    retry: (count, error) => !(error instanceof ApiError && error.status < 500 && error.status !== 0) && count < 2,
  })
}

function useInvalidate() {
  const client = useQueryClient()
  return () => Promise.all([client.invalidateQueries({ queryKey: KEY }), client.invalidateQueries({ queryKey: ['customers'] })])
}

export function useCreateVehicle() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => apiFetch<Vehicle>('/vehicles', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateVehicle() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | string; input: UpdateVehicleInput }) =>
      apiFetch<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteVehicle() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number | string) => apiFetch(`/vehicles/${id}`, { method: 'DELETE', noContent: true }),
    onSuccess: invalidate,
  })
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação. Tente de novo.'
}
