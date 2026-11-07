import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Car, CircleAlert, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../shared/api/errors'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Pagination,
  Plate,
  Skeleton,
  useToast,
} from '../../shared/ui'
import { useAuth } from '../auth/useAuth'
import { MODULES } from '../shell/modules'
import { apiErrorMessage, deleteErrorMessage, FUEL_LABELS, useCustomer, useCustomerVehicles, useDeleteCustomer } from './api'
import type { Customer } from './api'
import { CustomerFormDialog } from './CustomerFormDialog'
import { DocumentTag } from './CustomersPage'
import { formatDocument, formatPhone } from './format'

const VEHICLES_PAGE_SIZE = 10
const kmFormat = new Intl.NumberFormat('pt-BR')

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-mini font-semibold text-tinta-suave">{label}</dt>
      <dd className="mt-1 text-corpo break-words text-tinta">{children}</dd>
    </div>
  )
}

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const customer = useCustomer(id)
  useDocumentTitle(customer.data?.name ?? 'Cliente')

  if (customer.isPending) return <LoadingDetail />
  if (customer.isError || !customer.data) {
    const notFound = customer.error instanceof ApiError && (customer.error.status === 404 || customer.error.status === 422)
    return (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
        title={notFound ? 'Cliente não encontrado' : 'Não foi possível carregar o cliente'}
        description={notFound ? 'Ele pode ter sido excluído ou o endereço está incorreto.' : apiErrorMessage(customer.error)}
        action={
          notFound ? (
            <Link
              to="/clientes"
              className="inline-flex min-h-11 items-center gap-2 rounded-controle border border-linha bg-superficie px-4 font-semibold text-tinta shadow-controle hover:bg-fundo"
            >
              <ArrowLeft aria-hidden="true" size={18} />
              Voltar para clientes
            </Link>
          ) : (
            <Button onClick={() => void customer.refetch()}>Tentar de novo</Button>
          )
        }
      />
    )
  }
  return <CustomerDetail customer={customer.data} />
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canWrite = can('admin', 'reception')
  const remove = useDeleteCustomer()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function onDelete() {
    try {
      await remove.mutateAsync(customer.id)
      toast.success('Cliente excluído')
      setConfirming(false)
      navigate('/clientes', { replace: true })
    } catch (error) {
      setConfirmError(deleteErrorMessage(error))
    }
  }

  return (
    <>
      <Link
        to="/clientes"
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-md text-corpo font-medium text-tinta-suave hover:text-azul"
      >
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={2} />
        Voltar para clientes
      </Link>
      <PageHeader
        title={customer.name}
        subtitle={`${customer.document.length > 11 ? 'CNPJ' : 'CPF'} ${formatDocument(customer.document)}`}
        actions={
          canWrite && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Editar
              </Button>
              <Button
                variant="outline"
                className="text-critico-texto"
                onClick={() => {
                  setConfirmError(null)
                  setConfirming(true)
                }}
              >
                <Trash2 aria-hidden="true" />
                Excluir
              </Button>
            </>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card as="section" accent="menta" aria-labelledby="cliente-dados">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar name={customer.name} size="lg" decorative />
              <CardTitle as="h2" id="cliente-dados">
                Dados do cliente
              </CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-5">
              <Info label="CPF/CNPJ">
                <span className="inline-flex items-center gap-2 tabular-nums">
                  {formatDocument(customer.document)}
                  <DocumentTag document={customer.document} />
                </span>
              </Info>
              <Info label="Telefone">
                {customer.phone ? (
                  <a
                    href={`tel:+55${customer.phone}`}
                    className="inline-flex min-h-8 items-center gap-2 hover:text-azul"
                  >
                    <Phone aria-hidden="true" size={16} strokeWidth={1.75} className="text-tinta-suave" />
                    {formatPhone(customer.phone)}
                  </a>
                ) : (
                  <span className="text-tinta-suave">Não informado</span>
                )}
              </Info>
              <Info label="E-mail">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="inline-flex min-h-8 items-center gap-2 hover:text-azul">
                    <Mail aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0 text-tinta-suave" />
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-tinta-suave">Não informado</span>
                )}
              </Info>
              <Info label="Observações">
                {customer.notes ? (
                  <p className="whitespace-pre-line">{customer.notes}</p>
                ) : (
                  <span className="text-tinta-suave">Sem observações</span>
                )}
              </Info>
            </dl>
          </CardBody>
        </Card>

        <VehiclesCard customerId={customer.id} canWrite={canWrite} />
      </div>

      {canWrite && <CustomerFormDialog open={editing} customer={customer} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirming}
        destructive
        loading={remove.isPending}
        title="Excluir cliente?"
        confirmLabel="Excluir"
        description={
          <>
            <p>{`${customer.name} será removido do cadastro. Esta ação não pode ser desfeita.`}</p>
            {confirmError && (
              <p role="alert" className="mt-3 font-medium text-critico-texto">
                {confirmError}
              </p>
            )}
          </>
        }
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

function VehiclesCard({ customerId, canWrite }: { customerId: number; canWrite: boolean }) {
  const [page, setPage] = useState(1)
  const vehicles = useCustomerVehicles(customerId, { page, size: VEHICLES_PAGE_SIZE })
  const data = vehicles.data
  const vehiclesReady = MODULES.find((m) => m.id === 'veiculos')?.available ?? false

  const newVehicle = !canWrite ? undefined : vehiclesReady ? (
    <Link
      to={`/veiculos?novo=1&cliente=${customerId}`}
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-controle border border-azul bg-azul px-3 text-mini font-semibold text-white hover:border-azul-escuro hover:bg-azul-escuro"
    >
      <Plus aria-hidden="true" size={16} />
      Novo veículo
    </Link>
  ) : (
    <Button size="sm" variant="outline" disabled>
      <Plus aria-hidden="true" />
      Novo veículo
      <span className="rounded-pilula bg-atencao-fundo px-2 py-0.5 text-legenda font-semibold text-atencao-texto">
        Em breve
      </span>
    </Button>
  )

  return (
    <Card as="section" className="lg:col-span-2" aria-labelledby="cliente-veiculos">
      <CardHeader actions={newVehicle}>
        <CardTitle as="h2" id="cliente-veiculos">
          Veículos{data ? <span className="ml-2 text-corpo font-medium text-tinta-suave">({data.total})</span> : null}
        </CardTitle>
      </CardHeader>
      <CardBody>
        {vehicles.isPending ? (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">Carregando veículos</span>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : vehicles.isError && !data ? (
          <EmptyState
            bare
            icon={<CircleAlert strokeWidth={1.75} />}
            title="Não foi possível carregar os veículos"
            description={apiErrorMessage(vehicles.error)}
            action={<Button onClick={() => void vehicles.refetch()}>Tentar de novo</Button>}
          />
        ) : data && data.items.length === 0 ? (
          <EmptyState bare icon={<Car strokeWidth={1.75} />} title="Este cliente ainda não tem veículos." />
        ) : data ? (
          <>
            <ul aria-label="Veículos do cliente" className="divide-y divide-linha">
              {data.items.map((vehicle) => (
                <li key={vehicle.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5 first:pt-0 last:pb-0">
                  <Plate value={vehicle.plate} />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate font-semibold text-navy">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="truncate text-mini text-tinta-suave">
                      {vehicle.year} · {vehicle.color} · {FUEL_LABELS[vehicle.fuel] ?? vehicle.fuel}
                    </p>
                  </div>
                  <p className="text-corpo font-semibold whitespace-nowrap text-tinta tabular-nums">
                    {kmFormat.format(vehicle.current_km)} km
                  </p>
                </li>
              ))}
            </ul>
            {data.total > VEHICLES_PAGE_SIZE && (
              <Pagination
                className="mt-4"
                page={page}
                totalPages={Math.ceil(data.total / VEHICLES_PAGE_SIZE)}
                onPageChange={setPage}
                summary={`${data.total} veículos`}
              />
            )}
          </>
        ) : null}
      </CardBody>
    </Card>
  )
}

function LoadingDetail() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando cliente</span>
      <Skeleton className="mb-3 h-5 w-40" />
      <Skeleton className="mb-8 h-9 w-72" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card lg:col-span-2" />
      </div>
    </div>
  )
}
