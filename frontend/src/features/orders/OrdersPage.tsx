import { useEffect, useState } from 'react'
import { CircleAlert, ClipboardList, Columns3, List, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import {
  Button,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  Plate,
  SearchInput,
  Select,
  Skeleton,
  StatusPill,
  Table,
  Td,
  Th,
  Tr,
} from '../../shared/ui'
import type { StatusTone } from '../../shared/ui/StatusPill'
import { cn } from '../../shared/ui/cn'
import { useAuth } from '../auth/useAuth'
import { apiErrorMessage, formatDate, formatMoney, STATUSES, STATUS_LABELS, useOrders } from './api'
import type { OrderRow, OrderStatus } from './api'
import { OrderFormDialog } from './OrderFormDialog'

const PAGE_SIZES = [10, 20, 50]
const KANBAN_SIZE = 100

export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  aberta: 'info',
  aguardando_orcamento: 'attention',
  aguardando_aprovacao: 'attention',
  em_execucao: 'info',
  finalizada: 'ok',
  entregue: 'neutral',
}

const COLUMN_BG: Record<OrderStatus, string> = {
  aberta: 'bg-coluna-azul',
  aguardando_orcamento: 'bg-coluna-laranja',
  aguardando_aprovacao: 'bg-coluna-laranja',
  em_execucao: 'bg-coluna-azul',
  finalizada: 'bg-coluna-verde',
  entregue: 'bg-coluna-cinza',
}

type View = 'quadro' | 'lista'

export function OrdersPage() {
  useDocumentTitle('Ordens de serviço')
  const navigate = useNavigate()
  const { can } = useAuth()
  const canCreate = can('admin', 'reception')
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [preferred, setPreferred] = useState<View>('quadro')
  const view: View = isMobile ? 'lista' : preferred

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [creating, setCreating] = useState(false)

  const orders = useOrders(
    view === 'quadro' ? { page: 1, size: KANBAN_SIZE, q } : { page, size, q, status },
  )

  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, q])

  const data = orders.data
  const total = data?.total ?? 0
  const open = (order: OrderRow) => navigate(`/ordens-de-servico/${order.id}`)

  let content
  if (orders.isPending) {
    content = (
      <div role="status" aria-busy="true" className="grid gap-3">
        <span className="sr-only">Carregando ordens</span>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-card" />
        ))}
      </div>
    )
  } else if (orders.isError && !data) {
    content = (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
        title="Não foi possível carregar as ordens"
        description={apiErrorMessage(orders.error)}
        action={<Button onClick={() => void orders.refetch()}>Tentar de novo</Button>}
      />
    )
  } else if (data && data.items.length === 0) {
    content = (
      <EmptyState
        icon={<ClipboardList strokeWidth={1.75} />}
        title="Nenhuma ordem encontrada"
        description={canCreate ? 'Ajuste os filtros ou abra uma nova ordem.' : 'Ajuste os filtros para ver outras ordens.'}
        action={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Nova ordem
            </Button>
          )
        }
      />
    )
  } else if (data && view === 'quadro') {
    content = (
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3" aria-label="Quadro de ordens">
        {STATUSES.map((s) => {
          const items = data.items.filter((o) => o.status === s)
          return (
            <section key={s} aria-label={STATUS_LABELS[s]} className={cn('w-72 shrink-0 rounded-card p-3', COLUMN_BG[s])}>
              <h2 className="mb-3 flex items-center justify-between text-corpo font-semibold text-navy">
                {STATUS_LABELS[s]}
                <span className="rounded-pilula bg-superficie px-2 py-0.5 text-legenda text-tinta-suave">{items.length}</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {items.map((order) => (
                  <li key={order.id}>
                    <OrderCard order={order} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    )
  } else if (data) {
    content = isMobile ? (
      <ul aria-label="Ordens de serviço" className="flex flex-col gap-3">
        {data.items.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} />
          </li>
        ))}
      </ul>
    ) : (
      <Table aria-label="Ordens de serviço">
        <thead>
          <tr>
            <Th>Ordem</Th>
            <Th>Veículo</Th>
            <Th className="hidden lg:table-cell">Cliente</Th>
            <Th>Status</Th>
            <Th className="hidden lg:table-cell">Prazo</Th>
            <Th className="text-right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((order) => (
            <Tr key={order.id} onClick={() => open(order)} className="cursor-pointer">
              <Td>
                <Link to={`/ordens-de-servico/${order.id}`} className="font-semibold text-navy hover:text-azul hover:underline">
                  {order.number}
                </Link>
              </Td>
              <Td>
                <Plate value={order.vehicle.plate} size="sm" />
              </Td>
              <Td className="hidden text-tinta-suave lg:table-cell">{order.customer.name}</Td>
              <Td>
                <StatusPill variant={STATUS_TONE[order.status]}>{STATUS_LABELS[order.status]}</StatusPill>
              </Td>
              <Td className="hidden text-tinta-suave lg:table-cell">{formatDate(order.due_date)}</Td>
              <Td className="text-right whitespace-nowrap tabular-nums">{formatMoney(order.total)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )
  }

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        subtitle="Do pedido à entrega, com peças e mão de obra."
        actions={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Nova ordem
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        <FilterBar label="Filtros de ordens">
          <SearchInput
            aria-label="Buscar ordens"
            placeholder="Buscar por número, placa ou cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="max-sm:text-[16px]"
          />
          {view === 'lista' && (
            <Select
              aria-label="Filtrar por status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as OrderStatus | '')
                setPage(1)
              }}
              className="max-sm:text-[16px]"
            >
              <option value="">Todos os status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
          {!isMobile && (
            <div className="flex gap-2" role="group" aria-label="Modo de exibição">
              <Button variant={view === 'quadro' ? 'primary' : 'outline'} onClick={() => setPreferred('quadro')} aria-pressed={view === 'quadro'}>
                <Columns3 aria-hidden="true" />
                Quadro
              </Button>
              <Button variant={view === 'lista' ? 'primary' : 'outline'} onClick={() => setPreferred('lista')} aria-pressed={view === 'lista'}>
                <List aria-hidden="true" />
                Lista
              </Button>
            </div>
          )}
        </FilterBar>

        <div aria-busy={orders.isPlaceholderData || undefined} className={cn(orders.isPlaceholderData && 'opacity-60')}>
          {content}
        </div>

        {data && view === 'lista' && total > 0 && (
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / size))}
            onPageChange={setPage}
            pageSize={size}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={(next) => {
              setSize(next)
              setPage(1)
            }}
            summary={<span aria-live="polite">{total} {total === 1 ? 'ordem' : 'ordens'}</span>}
          />
        )}
        {data && view === 'quadro' && total > KANBAN_SIZE && (
          <p className="text-corpo text-tinta-suave">Mostrando as {KANBAN_SIZE} mais recentes. Use a lista para ver todas.</p>
        )}
      </div>

      {canCreate && (
        <OrderFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(order) => navigate(`/ordens-de-servico/${order.id}`)} />
      )}
    </>
  )
}

function OrderCard({ order }: { order: OrderRow }) {
  return (
    <Link
      to={`/ordens-de-servico/${order.id}`}
      className="block rounded-card border border-linha bg-superficie p-4 shadow-card transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-navy">{order.number}</span>
        <StatusPill variant={STATUS_TONE[order.status]}>{STATUS_LABELS[order.status]}</StatusPill>
      </div>
      <div className="mt-2">
        <Plate value={order.vehicle.plate} size="sm" />
      </div>
      <p className="mt-2 truncate text-corpo text-tinta">
        {order.vehicle.brand} {order.vehicle.model}
      </p>
      <p className="truncate text-mini text-tinta-suave">{order.customer.name}</p>
      <div className="mt-2 flex items-center justify-between text-mini text-tinta-suave">
        <span>{order.due_date ? `Prazo ${formatDate(order.due_date)}` : 'Sem prazo'}</span>
        <span className="font-semibold text-tinta tabular-nums">{formatMoney(order.total)}</span>
      </div>
    </Link>
  )
}
