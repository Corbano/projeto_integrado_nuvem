import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../shared/api/client'
import { ApiError } from '../../shared/api/errors'

/** Dados mínimos de um cliente, suficientes para escolher em listas e autocompletar. */
export interface CustomerSummary {
  id: number
  name: string
  /** Só dígitos (a API guarda sem máscara). */
  document: string
  phone: string | null
}

export interface Customer extends CustomerSummary {
  email: string | null
  notes: string | null
}

export interface CustomerList {
  items: Customer[]
  total: number
  page: number
  size: number
}

export interface ListCustomersParams {
  page: number
  size: number
  q: string
}

export interface CreateCustomerInput {
  name: string
  document: string
  phone?: string | null
  email?: string | null
  notes?: string | null
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>

export type Fuel = 'gasolina' | 'etanol' | 'flex' | 'diesel' | 'gnv' | 'eletrico' | 'hibrido'

export const FUEL_LABELS: Record<Fuel, string> = {
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  flex: 'Flex',
  diesel: 'Diesel',
  gnv: 'GNV',
  eletrico: 'Elétrico',
  hibrido: 'Híbrido',
}

export interface CustomerVehicle {
  id: number
  customer_id: number
  plate: string
  brand: string
  model: string
  year: number
  color: string
  fuel: Fuel
  current_km: number
}

export interface CustomerVehicleList {
  items: CustomerVehicle[]
  total: number
  page: number
  size: number
}

export function listCustomers({ page, size, q }: ListCustomersParams, signal?: AbortSignal): Promise<CustomerList> {
  const query = new URLSearchParams({ page: String(page), size: String(size) })
  if (q.trim()) query.set('q', q.trim())
  return apiFetch<CustomerList>(`/customers?${query.toString()}`, { signal })
}

export function getCustomer(id: number | string, signal?: AbortSignal): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, { signal })
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/customers', { method: 'POST', body: input })
}

export function updateCustomer(id: number | string, input: UpdateCustomerInput): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, { method: 'PATCH', body: input })
}

export function deleteCustomer(id: number | string): Promise<void> {
  return apiFetch(`/customers/${id}`, { method: 'DELETE', noContent: true })
}

export function listCustomerVehicles(
  id: number | string,
  { page, size }: { page: number; size: number },
  signal?: AbortSignal,
): Promise<CustomerVehicleList> {
  return apiFetch<CustomerVehicleList>(`/customers/${id}/vehicles?page=${page}&size=${size}`, { signal })
}

const CUSTOMERS_KEY = ['customers'] as const

export function useCustomers(params: ListCustomersParams) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'list', params],
    queryFn: ({ signal }) => listCustomers(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useCustomer(id: number | string | null | undefined) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'detail', String(id)],
    queryFn: ({ signal }) => getCustomer(id as number | string, signal),
    enabled: id !== null && id !== undefined && String(id) !== '',
    retry: (count, error) => !(error instanceof ApiError && error.status < 500 && error.status !== 0) && count < 2,
  })
}

export function useCustomerVehicles(id: number | string, params: { page: number; size: number }) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'vehicles', String(id), params],
    queryFn: ({ signal }) => listCustomerVehicles(id, params, signal),
    placeholderData: keepPreviousData,
  })
}

/** Busca para autocompletar e paleta de comandos; `enabled` evita chamadas sem necessidade. */
export function useCustomerSearch(q: string, size: number, enabled = true) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'search', q, size],
    queryFn: ({ signal }) => listCustomers({ page: 1, size, q }, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useCreateCustomer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => client.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useUpdateCustomer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | string; input: UpdateCustomerInput }) => updateCustomer(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useDeleteCustomer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => deleteCustomer(id),
    onSuccess: () => client.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export const HAS_VEHICLES_MESSAGE = 'Exclua ou transfira os veículos antes de excluir este cliente.'

/** Mensagem amigável para falhas ao excluir (o 422 "possui veículos" ganha uma instrução). */
export function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422 && /ve[ií]culos/i.test(error.message)) return HAS_VEHICLES_MESSAGE
    return error.message
  }
  return 'Não foi possível concluir a operação. Tente de novo.'
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação. Tente de novo.'
}
