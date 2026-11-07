import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { CircleAlert, Eye, Mail, Pencil, Phone, Plus, Trash2, Contact } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
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
  Table,
  Td,
  Th,
  Tr,
  useToast,
} from '../../shared/ui'
import type { RowAction } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { useAuth } from '../auth/useAuth'
import { apiErrorMessage, deleteErrorMessage, useCustomers, useDeleteCustomer } from './api'
import type { Customer } from './api'
import { CustomerFormDialog } from './CustomerFormDialog'
import { documentType, formatDocument, formatPhone } from './format'

const PAGE_SIZES = [10, 20, 50]
const SEARCH_DELAY_MS = 300

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; customer: Customer }

export function DocumentTag({ document }: { document: string }) {
  return (
    <span className="rounded-md bg-info-fundo px-1.5 py-0.5 text-legenda font-bold tracking-wide text-azul">
      {documentType(document)}
    </span>
  )
}

/** Cliques em links e botões da linha não devem abrir o detalhe duas vezes. */
function isInteractive(event: MouseEvent): boolean {
  return event.target instanceof Element && event.target.closest('a, button, [role="menu"]') !== null
}

export function CustomersPage() {
  useDocumentTitle('Clientes')
  const toast = useToast()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canWrite = can('admin', 'reception')
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [confirm, setConfirm] = useState<Customer | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const customers = useCustomers({ page, size, q })
  const remove = useDeleteCustomer()

  // Busca com atraso de 300 ms; uma nova busca volta para a página 1.
  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, q])

  const data = customers.data
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / size))
  const firstShown = total === 0 ? 0 : (page - 1) * size + 1
  const lastShown = Math.min(total, page * size)
  const searching = q.trim().length > 0

  const open = (customer: Customer) => navigate(`/clientes/${customer.id}`)

  function actionsFor(customer: Customer): RowAction[] {
    const actions: RowAction[] = [{ label: 'Ver detalhes', icon: <Eye />, onSelect: () => open(customer) }]
    if (canWrite) {
      actions.push(
        { label: 'Editar', icon: <Pencil />, onSelect: () => setForm({ mode: 'edit', customer }) },
        {
          label: 'Excluir',
          icon: <Trash2 />,
          danger: true,
          onSelect: () => {
            setConfirmError(null)
            setConfirm(customer)
          },
        },
      )
    }
    return actions
  }

  async function onConfirm() {
    if (!confirm) return
    try {
      await remove.mutateAsync(confirm.id)
      if (page > 1 && data?.items.length === 1) setPage(page - 1)
      toast.success('Cliente excluído')
      setConfirm(null)
    } catch (error) {
      setConfirmError(deleteErrorMessage(error))
    }
  }

  const openCreate = () => setForm({ mode: 'create' })

  let content
  if (customers.isPending) {
    content = <LoadingList mobile={isMobile} rows={Math.min(size, 6)} />
  } else if (customers.isError && !data) {
    content = (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
        title="Não foi possível carregar os clientes"
        description={apiErrorMessage(customers.error)}
        action={<Button onClick={() => void customers.refetch()}>Tentar de novo</Button>}
      />
    )
  } else if (data && data.items.length === 0) {
    content = (
      <EmptyState
        icon={<Contact strokeWidth={1.75} />}
        title="Nenhum cliente encontrado"
        description={
          canWrite ? 'Limpe a busca ou cadastre um novo cliente.' : 'Limpe a busca para ver todos os clientes.'
        }
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
            {canWrite && (
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" />
                Novo cliente
              </Button>
            )}
          </div>
        }
      />
    )
  } else if (data) {
    content = (
      <div aria-busy={customers.isPlaceholderData || undefined} className={cn(customers.isPlaceholderData && 'opacity-60')}>
        {isMobile ? (
          <ul aria-label="Clientes" className="flex flex-col gap-3">
            {data.items.map((customer) => (
              <li
                key={customer.id}
                onClick={(event) => !isInteractive(event) && open(customer)}
                className="flex cursor-pointer items-start gap-3 rounded-card border border-linha bg-superficie p-4 shadow-card"
              >
                <Avatar name={customer.name} size="lg" decorative />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/clientes/${customer.id}`}
                    className="block truncate text-destaque font-semibold text-navy hover:text-azul"
                  >
                    {customer.name}
                  </Link>
                  <p className="mt-0.5 flex items-center gap-2 text-corpo text-tinta-suave tabular-nums">
                    <DocumentTag document={customer.document} />
                    {formatDocument(customer.document)}
                  </p>
                  {customer.phone && (
                    <a
                      href={`tel:+55${customer.phone}`}
                      className="mt-1.5 flex min-h-8 items-center gap-2 text-corpo text-tinta hover:text-azul"
                    >
                      <Phone aria-hidden="true" size={15} strokeWidth={1.75} className="text-tinta-suave" />
                      {formatPhone(customer.phone)}
                    </a>
                  )}
                  {customer.email && (
                    <p className="flex items-center gap-2 text-corpo text-tinta-suave">
                      <Mail aria-hidden="true" size={15} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </p>
                  )}
                </div>
                <RowActions label={customer.name} actions={actionsFor(customer)} className="size-11!" />
              </li>
            ))}
          </ul>
        ) : (
          <Table aria-label="Clientes">
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>CPF/CNPJ</Th>
                <Th>Telefone</Th>
                <Th className="hidden lg:table-cell">E-mail</Th>
                <Th className="w-16">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((customer) => (
                <Tr
                  key={customer.id}
                  onClick={(event) => !isInteractive(event) && open(customer)}
                  className="cursor-pointer"
                >
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={customer.name} decorative />
                      <div className="min-w-0">
                        <Link
                          to={`/clientes/${customer.id}`}
                          className="block font-semibold text-navy hover:text-azul hover:underline"
                        >
                          {customer.name}
                        </Link>
                        {customer.email && (
                          <p className="text-mini text-tinta-suave lg:hidden">{customer.email}</p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      {formatDocument(customer.document)}
                      <DocumentTag document={customer.document} />
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-tinta-suave">
                    {customer.phone ? formatPhone(customer.phone) : '—'}
                  </Td>
                  <Td className="hidden text-tinta-suave lg:table-cell">{customer.email ?? '—'}</Td>
                  <Td className="text-right">
                    <RowActions label={customer.name} actions={actionsFor(customer)} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro de clientes com contato e documento."
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" />
              Novo cliente
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        <FilterBar label="Busca de clientes">
          <SearchInput
            aria-label="Buscar clientes"
            placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
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
                Mostrando {firstShown}–{lastShown} de {total} {total === 1 ? 'cliente' : 'clientes'}
              </span>
            }
          />
        )}
      </div>

      {canWrite && (
        <CustomerFormDialog
          open={form.mode !== 'closed'}
          customer={form.mode === 'edit' ? form.customer : null}
          onClose={() => setForm({ mode: 'closed' })}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        destructive
        loading={remove.isPending}
        title="Excluir cliente?"
        confirmLabel="Excluir"
        description={
          <>
            <p>{`${confirm?.name ?? ''} será removido do cadastro. Esta ação não pode ser desfeita.`}</p>
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
      <span className="sr-only">Carregando clientes</span>
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
              <Skeleton className="ml-6 h-4 w-36" />
              <Skeleton className="ml-6 h-4 w-28" />
              <Skeleton className="ml-6 h-4 w-48" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
