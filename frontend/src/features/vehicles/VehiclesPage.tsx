import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Car, CircleAlert, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  Plate,
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
import { apiErrorMessage, FUEL_LABELS, useDeleteVehicle, useVehicles } from './api'
import type { Vehicle } from './api'
import { VehicleFormDialog } from './VehicleFormDialog'

const PAGE_SIZES = [10, 20, 50]
const SEARCH_DELAY_MS = 300
export const kmFormat = new Intl.NumberFormat('pt-BR')

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; vehicle: Vehicle }

function isInteractive(event: MouseEvent): boolean {
  return event.target instanceof Element && event.target.closest('a, button, [role="menu"]') !== null
}

export function VehiclesPage() {
  useDocumentTitle('Veículos')
  const toast = useToast()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canWrite = can('admin', 'reception')
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [params, setParams] = useSearchParams()
  const presetCustomer = Number(params.get('cliente')) || null

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [form, setForm] = useState<FormState>(
    canWrite && params.get('novo') === '1' ? { mode: 'create' } : { mode: 'closed' },
  )
  const [confirm, setConfirm] = useState<Vehicle | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const vehicles = useVehicles({ page, size, q })
  const remove = useDeleteVehicle()

  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, q])

  const data = vehicles.data
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / size))
  const firstShown = total === 0 ? 0 : (page - 1) * size + 1
  const lastShown = Math.min(total, page * size)
  const searching = q.trim().length > 0

  const open = (vehicle: Vehicle) => navigate(`/veiculos/${vehicle.id}`)

  function closeForm() {
    setForm({ mode: 'closed' })
    if (params.has('novo') || params.has('cliente')) setParams({}, { replace: true })
  }

  function actionsFor(vehicle: Vehicle): RowAction[] {
    const actions: RowAction[] = [{ label: 'Ver detalhes', icon: <Eye />, onSelect: () => open(vehicle) }]
    if (canWrite) {
      actions.push(
        { label: 'Editar', icon: <Pencil />, onSelect: () => setForm({ mode: 'edit', vehicle }) },
        {
          label: 'Excluir',
          icon: <Trash2 />,
          danger: true,
          onSelect: () => {
            setConfirmError(null)
            setConfirm(vehicle)
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
      toast.success('Veículo excluído')
      setConfirm(null)
    } catch (error) {
      setConfirmError(apiErrorMessage(error))
    }
  }

  const openCreate = () => setForm({ mode: 'create' })

  let content
  if (vehicles.isPending) {
    content = <LoadingList mobile={isMobile} rows={Math.min(size, 6)} />
  } else if (vehicles.isError && !data) {
    content = (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
        title="Não foi possível carregar os veículos"
        description={apiErrorMessage(vehicles.error)}
        action={<Button onClick={() => void vehicles.refetch()}>Tentar de novo</Button>}
      />
    )
  } else if (data && data.items.length === 0) {
    content = (
      <EmptyState
        icon={<Car strokeWidth={1.75} />}
        title="Nenhum veículo encontrado"
        description={canWrite ? 'Limpe a busca ou cadastre um novo veículo.' : 'Limpe a busca para ver todos os veículos.'}
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
                Novo veículo
              </Button>
            )}
          </div>
        }
      />
    )
  } else if (data) {
    content = (
      <div aria-busy={vehicles.isPlaceholderData || undefined} className={cn(vehicles.isPlaceholderData && 'opacity-60')}>
        {isMobile ? (
          <ul aria-label="Veículos" className="flex flex-col gap-3">
            {data.items.map((vehicle) => (
              <li
                key={vehicle.id}
                onClick={(event) => !isInteractive(event) && open(vehicle)}
                className="flex cursor-pointer items-start gap-3 rounded-card border border-linha bg-superficie p-4 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <Plate value={vehicle.plate} />
                  <Link
                    to={`/veiculos/${vehicle.id}`}
                    className="mt-2 block truncate text-destaque font-semibold text-navy hover:text-azul"
                  >
                    {vehicle.brand} {vehicle.model}
                  </Link>
                  <p className="text-corpo text-tinta-suave">
                    {vehicle.year} · {vehicle.color} · {FUEL_LABELS[vehicle.fuel]}
                  </p>
                  <p className="mt-1 text-corpo font-semibold text-tinta tabular-nums">
                    {kmFormat.format(vehicle.current_km)} km
                  </p>
                </div>
                <RowActions label={`${vehicle.brand} ${vehicle.model}`} actions={actionsFor(vehicle)} className="size-11!" />
              </li>
            ))}
          </ul>
        ) : (
          <Table aria-label="Veículos">
            <thead>
              <tr>
                <Th>Placa</Th>
                <Th>Veículo</Th>
                <Th className="hidden lg:table-cell">Cor</Th>
                <Th className="hidden lg:table-cell">Combustível</Th>
                <Th className="text-right">Quilometragem</Th>
                <Th className="w-16">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((vehicle) => (
                <Tr key={vehicle.id} onClick={(event) => !isInteractive(event) && open(vehicle)} className="cursor-pointer">
                  <Td>
                    <Plate value={vehicle.plate} size="sm" />
                  </Td>
                  <Td>
                    <Link to={`/veiculos/${vehicle.id}`} className="block font-semibold text-navy hover:text-azul hover:underline">
                      {vehicle.brand} {vehicle.model}
                    </Link>
                    <p className="text-mini text-tinta-suave">{vehicle.year}</p>
                  </Td>
                  <Td className="hidden text-tinta-suave lg:table-cell">{vehicle.color}</Td>
                  <Td className="hidden text-tinta-suave lg:table-cell">{FUEL_LABELS[vehicle.fuel]}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{kmFormat.format(vehicle.current_km)} km</Td>
                  <Td className="text-right">
                    <RowActions label={`${vehicle.brand} ${vehicle.model}`} actions={actionsFor(vehicle)} />
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
        title="Veículos"
        subtitle="Carros, placas e quilometragem dos clientes."
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" />
              Novo veículo
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        <FilterBar label="Busca de veículos">
          <SearchInput
            aria-label="Buscar veículos"
            placeholder="Buscar por placa, marca, modelo ou cliente"
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
                Mostrando {firstShown}–{lastShown} de {total} {total === 1 ? 'veículo' : 'veículos'}
              </span>
            }
          />
        )}
      </div>

      {canWrite && (
        <VehicleFormDialog
          open={form.mode !== 'closed'}
          vehicle={form.mode === 'edit' ? form.vehicle : null}
          initialCustomerId={presetCustomer}
          onClose={closeForm}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        destructive
        loading={remove.isPending}
        title="Excluir veículo?"
        confirmLabel="Excluir"
        description={
          <>
            <p>{`${confirm ? `${confirm.brand} ${confirm.model} (${confirm.plate})` : ''} será removido do cadastro. Esta ação não pode ser desfeita.`}</p>
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
      <span className="sr-only">Carregando veículos</span>
      {mobile ? (
        <div className="flex flex-col gap-3">
          {items.map((i) => (
            <div key={i} className="space-y-2 rounded-card border border-linha bg-superficie p-4 shadow-card">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-linha bg-superficie shadow-card">
          <div className="h-11 rounded-t-[15px] border-b border-linha bg-fundo" />
          {items.map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-linha px-4 py-3.5 last:border-b-0">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="ml-6 h-4 w-24" />
              <Skeleton className="ml-6 h-4 w-20" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
