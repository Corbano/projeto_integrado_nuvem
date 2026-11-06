import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../shared/api/client'
import type { Role, User } from '../../shared/api/types'

export interface UserList {
  items: User[]
  total: number
  page: number
  size: number
}

export interface ListUsersParams {
  page: number
  size: number
  q: string
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: Role
}

export interface UpdateUserInput {
  name?: string
  password?: string
  role?: Role
  active?: boolean
}

export function listUsers({ page, size, q }: ListUsersParams, signal?: AbortSignal): Promise<UserList> {
  const query = new URLSearchParams({ page: String(page), size: String(size) })
  if (q.trim()) query.set('q', q.trim())
  return apiFetch<UserList>(`/users?${query.toString()}`, { signal })
}

export function createUser(input: CreateUserInput): Promise<User> {
  return apiFetch<User>('/users', { method: 'POST', body: input })
}

export function updateUser(id: User['id'], input: UpdateUserInput): Promise<User> {
  return apiFetch<User>(`/users/${id}`, { method: 'PATCH', body: input })
}

export function deleteUser(id: User['id']): Promise<void> {
  return apiFetch(`/users/${id}`, { method: 'DELETE', noContent: true })
}

const USERS_KEY = ['users'] as const

export function useUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: [...USERS_KEY, params],
    queryFn: ({ signal }) => listUsers(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useCreateUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => client.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: User['id']; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useDeleteUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: User['id']) => deleteUser(id),
    onSuccess: () => client.invalidateQueries({ queryKey: USERS_KEY }),
  })
}
