import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../shared/api/client'
import { ApiError } from '../../shared/api/errors'
import type { Role } from '../../shared/api/types'

export type OrderStatus =
  | 'aberta'
  | 'aguardando_orcamento'
  | 'aguardando_aprovacao'
  | 'em_execucao'
  | 'finalizada'
  | 'entregue'

export const STATUSES: OrderStatus[] = [
  'aberta',
  'aguardando_orcamento',
  'aguardando_aprovacao',
  'em_execucao',
  'finalizada',
  'entregue',
]

export const STATUS_LABELS: Record<OrderStatus, string> = {
  aberta: 'Aberta',
  aguardando_orcamento: 'Aguardando orçamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_execucao: 'Em execução',
  finalizada: 'Finalizada',
  entregue: 'Entregue',
}

/** Espelha as transições do backend; a API continua sendo a autoridade. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  aberta: ['aguardando_orcamento'],
  aguardando_orcamento: ['aguardando_aprovacao'],
  aguardando_aprovacao: ['em_execucao', 'aguardando_orcamento'],
  em_execucao: ['finalizada'],
  finalizada: ['entregue'],
  entregue: [],
}

const FRONT_DESK: Role[] = ['admin', 'reception']
export function canTransition(role: Role | undefined, from: OrderStatus, to: OrderStatus): boolean {
  if (!role || !TRANSITIONS[from].includes(to)) return false
  if (from === 'em_execucao') return role === 'admin' || role === 'mechanic'
  return FRONT_DESK.includes(role)
}

export type ItemKind = 'service' | 'part'
export const KIND_LABELS: Record<ItemKind, string> = { service: 'Serviço', part: 'Peça' }

export interface OrderItem {
  id: number
  kind: ItemKind
  description: string
  qty: string
  unit_price: string
  line_total: string
  rule_code: string | null
}

export interface VehicleSummary {
  id: number
  plate: string
  brand: string
  model: string
}

export interface OrderRow {
  id: number
  number: string
  vehicle_id: number
  checkin_id: number | null
  mechanic_id: number | null
  reported_issue: string
  diagnosis: string | null
  labor_cost: string
  total: string
  due_date: string | null
  status: OrderStatus
  created_at: string | null
  updated_at: string | null
  vehicle: VehicleSummary
  customer: { id: number; name: string }
}

export interface OrderDetail extends Omit<OrderRow, 'vehicle' | 'customer'> {
  items: OrderItem[]
  history: { from_status: OrderStatus | null; to_status: OrderStatus; changed_by_id: number | null; changed_at: string | null }[]
  vehicle: VehicleSummary | null
  customer: { id: number; name: string } | null
  mechanic: { id: number; name: string } | null
}

export interface OrderList {
  items: OrderRow[]
  total: number
  page: number
  size: number
}

export interface ListOrdersParams {
  page: number
  size: number
  q: string
  status?: OrderStatus | ''
  vehicleId?: number | null
}

export interface CreateOrderInput {
  vehicle_id: number
  mechanic_id?: number | null
  reported_issue: string
  labor_cost?: string
  due_date?: string | null
}

export interface UpdateOrderInput {
  reported_issue?: string
  diagnosis?: string | null
  labor_cost?: string
  due_date?: string | null
  mechanic_id?: number | null
}

export interface ItemInput {
  kind: ItemKind
  description: string
  qty: string
  unit_price: string
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function formatMoney(value: string | number): string {
  return brl.format(Number(value))
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const KEY = ['orders'] as const

export function useOrders(params: ListOrdersParams) {
  return useQuery({
    queryKey: [...KEY, 'list', params],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ page: String(params.page), size: String(params.size) })
      if (params.q.trim()) query.set('q', params.q.trim())
      if (params.status) query.set('status', params.status)
      if (params.vehicleId) query.set('vehicle_id', String(params.vehicleId))
      return apiFetch<OrderList>(`/service-orders?${query.toString()}`, { signal })
    },
    placeholderData: keepPreviousData,
  })
}

export function useOrder(id: number | string) {
  return useQuery({
    queryKey: [...KEY, 'detail', String(id)],
    queryFn: ({ signal }) => apiFetch<OrderDetail>(`/service-orders/${id}`, { signal }),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500 && error.status !== 0) && count < 2,
  })
}

function useInvalidate() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: KEY })
}

export function useCreateOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateOrderInput) => apiFetch<OrderDetail>('/service-orders', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateOrder(id: number | string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: UpdateOrderInput) => apiFetch<OrderDetail>(`/service-orders/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useChangeStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, to }: { id: number | string; to: OrderStatus }) =>
      apiFetch<OrderDetail>(`/service-orders/${id}/status`, { method: 'POST', body: { to } }),
    onSuccess: invalidate,
  })
}

export function useAddItem(id: number | string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: ItemInput) => apiFetch<OrderDetail>(`/service-orders/${id}/items`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteItem(id: number | string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (itemId: number) => apiFetch(`/service-orders/${id}/items/${itemId}`, { method: 'DELETE', noContent: true }),
    onSuccess: invalidate,
  })
}

export function useDeleteOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number | string) => apiFetch(`/service-orders/${id}`, { method: 'DELETE', noContent: true }),
    onSuccess: invalidate,
  })
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação. Tente de novo.'
}
