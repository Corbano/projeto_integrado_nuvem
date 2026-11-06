import { useEffect, useState } from 'react'
import { CircleAlert, Pencil, Plus, Trash2, UserCheck, UserRoundX, Users } from 'lucide-react'
import { ApiError } from '../../shared/api/errors'
import type { User } from '../../shared/api/types'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  RowActions,
  SearchInput,
  Skeleton,
  StatusPill,
  Table,
  Td,
  Th,
  Tr,
  useToast,
} from '../../shared/ui'
import type { RowAction } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { useAuth } from '../auth/useAuth'
import { useDeleteUser, useUpdateUser, useUsers } from './api'
import { ROLE_LABELS, ROLE_TONES } from './roleLabels'
import { UserFormDialog } from './UserFormDialog'

const PAGE_SIZES = [10, 20, 50]
const SEARCH_DELAY_MS = 300

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; user: User }
type ConfirmState = { kind: 'delete' | 'deactivate'; user: User } | null

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação. Tente de novo.'
}

function RolePill({ user }: { user: User }) {
  return (
    <StatusPill variant={ROLE_TONES[user.role]} dot={false}>
      {ROLE_LABELS[user.role]}
    </StatusPill>
  )
}

function StatePill({ user }: { user: User }) {
  return <StatusPill variant={user.active ? 'ok' : 'neutral'}>{user.active ? 'Ativo' : 'Inativo'}</StatusPill>
}

function SelfTag() {
  return (
    <span className="rounded-pilula bg-info-fundo px-2 py-0.5 text-legenda font-semibold text-azul">Você</span>
  )
}

export function UsersPage() {
  useDocumentTitle('Usuários')
  const toast = useToast()
  const { user: me } = useAuth()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const users = useUsers({ page, size, q })
  const update = useUpdateUser()
  const remove = useDeleteUser()

  // Busca com atraso de 300 ms; uma nova busca volta para a página 1.
  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, q])

  const data = users.data
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / size))

  function isSelf(user: User) {
    return me !== null && String(me.id) === String(user.id)
  }

  function actionsFor(user: User): RowAction[] {
    const self = isSelf(user)
    return [
      { label: 'Editar', icon: <Pencil />, onSelect: () => setForm({ mode: 'edit', user }) },
      user.active
        ? {
            label: 'Desativar',
            icon: <UserRoundX />,
            disabled: self,
            hint: self ? 'Você não pode se desativar.' : undefined,
            onSelect: () => openConfirm('deactivate', user),
          }
        : { label: 'Ativar', icon: <UserCheck />, onSelect: () => void activate(user) },
      {
        label: 'Excluir',
        icon: <Trash2 />,
        danger: true,
        disabled: self,
        hint: self ? 'Você não pode se excluir.' : undefined,
        onSelect: () => openConfirm('delete', user),
      },
    ]
  }

  function openConfirm(kind: 'delete' | 'deactivate', user: User) {
    setConfirmError(null)
    setConfirm({ kind, user })
  }

  async function activate(user: User) {
    try {
      await update.mutateAsync({ id: user.id, input: { active: true } })
      toast.success('Usuário ativado')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function onConfirm() {
    if (!confirm) return
    try {
      if (confirm.kind === 'delete') {
        await remove.mutateAsync(confirm.user.id)
        // Excluiu o último item da página: volta para a anterior.
        if (page > 1 && data?.items.length === 1) setPage(page - 1)
        toast.success('Usuário excluído')
      } else {
        await update.mutateAsync({ id: confirm.user.id, input: { active: false } })
        toast.success('Usuário desativado')
      }
      setConfirm(null)
    } catch (error) {
      setConfirmError(errorMessage(error))
    }
  }

  const firstShown = total === 0 ? 0 : (page - 1) * size + 1
  const lastShown = Math.min(total, page * size)
  const busy = confirm?.kind === 'delete' ? remove.isPending : update.isPending
  const searching = q.trim().length > 0

  const openCreate = () => setForm({ mode: 'create' })

  let content
  if (users.isPending) {
    content = <LoadingList mobile={isMobile} rows={Math.min(size, 6)} />
  } else if (users.isError && !data) {
    content = (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
        title="Não foi possível carregar os usuários"
        description={errorMessage(users.error)}
        action={<Button onClick={() => void users.refetch()}>Tentar de novo</Button>}
      />
    )
  } else if (data && data.items.length === 0) {
    content = (
      <EmptyState
        icon={<Users strokeWidth={1.75} />}
        title="Nenhum usuário encontrado"
        description="Limpe a busca ou crie um novo usuário."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            {searching && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setQ('')
                  setPage(1)
                }}
              >
                Limpar busca
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" />
              Novo usuário
            </Button>
          </div>
        }
      />
    )
  } else if (data) {
    content = (
      <div aria-busy={users.isPlaceholderData || undefined} className={cn(users.isPlaceholderData && 'opacity-60')}>
        {isMobile ? (
          <ul aria-label="Usuários" className="flex flex-col gap-3">
            {data.items.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-card border border-linha bg-superficie p-4 shadow-card"
              >
                <Avatar name={user.name} size="lg" decorative />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-destaque font-semibold text-tinta">
                    <span className="truncate">{user.name}</span>
                    {isSelf(user) && <SelfTag />}
                  </p>
                  <p className="truncate text-corpo text-tinta-suave">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <RolePill user={user} />
                    <StatePill user={user} />
                  </div>
                </div>
                <RowActions label={user.name} actions={actionsFor(user)} className="size-11!" />
              </li>
            ))}
          </ul>
        ) : (
          <Table aria-label="Usuários">
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th className="hidden xl:table-cell">E-mail</Th>
                <Th>Perfil</Th>
                <Th>Estado</Th>
                <Th className="w-16">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <Tr key={user.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} decorative />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold text-navy">
                          {user.name}
                          {isSelf(user) && <SelfTag />}
                        </p>
                        <p className="text-mini text-tinta-suave xl:hidden">{user.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden text-tinta-suave xl:table-cell">{user.email}</Td>
                  <Td>
                    <RolePill user={user} />
                  </Td>
                  <Td>
                    <StatePill user={user} />
                  </Td>
                  <Td className="text-right">
                    <RowActions label={user.name} actions={actionsFor(user)} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    )
  }

  const confirmName = confirm?.user.name ?? ''

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Contas da equipe e perfis de acesso ao sistema."
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            Novo usuário
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <FilterBar label="Busca de usuários">
          <SearchInput
            aria-label="Buscar usuários"
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="max-sm:text-[16px]"
          />
        </FilterBar>

        {content}

        {data && total > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={size}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={(next) => {
              setSize(next)
              setPage(1)
            }}
            summary={
              <span aria-live="polite">
                Mostrando {firstShown}–{lastShown} de {total} {total === 1 ? 'usuário' : 'usuários'}
              </span>
            }
          />
        )}
      </div>

      <UserFormDialog
        open={form.mode !== 'closed'}
        user={form.mode === 'edit' ? form.user : null}
        currentUserId={me?.id}
        onClose={() => setForm({ mode: 'closed' })}
      />

      <ConfirmDialog
        open={confirm !== null}
        destructive
        loading={busy}
        title={confirm?.kind === 'delete' ? 'Excluir usuário?' : 'Desativar usuário?'}
        confirmLabel={confirm?.kind === 'delete' ? 'Excluir' : 'Desativar'}
        description={
          <>
            <p>
              {confirm?.kind === 'delete'
                ? `${confirmName} perderá o acesso. Esta ação não pode ser desfeita.`
                : `${confirmName} não conseguirá mais entrar no sistema. Você pode ativar a conta de novo quando quiser.`}
            </p>
            {confirmError && (
              <p role="alert" className="mt-3 font-medium text-critico-texto">
                {confirmError}
              </p>
            )}
          </>
        }
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}

function LoadingList({ mobile, rows }: { mobile: boolean; rows: number }) {
  const items = Array.from({ length: rows }, (_, index) => index)
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando usuários</span>
      {mobile ? (
        <div className="flex flex-col gap-3">
          {items.map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border border-linha bg-superficie p-4 shadow-card">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-linha bg-superficie shadow-card">
          <div className="h-11 rounded-t-[15px] border-b border-linha bg-fundo" />
          {items.map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-linha px-4 py-3.5 last:border-b-0">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-6 h-4 w-56" />
              <Skeleton className="ml-6 h-5 w-24 rounded-pilula" />
              <Skeleton className="h-5 w-16 rounded-pilula" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
