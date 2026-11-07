import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, CircleAlert, Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../shared/api/errors'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Plate,
  Skeleton,
  useToast,
} from '../../shared/ui'
import { useAuth } from '../auth/useAuth'
import { apiErrorMessage, FUEL_LABELS, useDeleteVehicle, useVehicle } from './api'
import type { VehicleDetail } from './api'
import { VehicleFormDialog } from './VehicleFormDialog'

const kmFormat = new Intl.NumberFormat('pt-BR')

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-mini font-semibold text-tinta-suave">{label}</dt>
      <dd className="mt-1 text-corpo break-words text-tinta">{children}</dd>
    </div>
  )
}

const NONE = <span className="text-tinta-suave">Não informado</span>

export function VehicleDetailPage() {
  const { id = '' } = useParams()
  const vehicle = useVehicle(id)
  useDocumentTitle(vehicle.data ? `${vehicle.data.brand} ${vehicle.data.model}` : 'Veículo')

  if (vehicle.isPending) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Carregando veículo</span>
        <Skeleton className="mb-8 h-9 w-72" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    )
  }
  if (vehicle.isError || !vehicle.data) {
    const notFound = vehicle.error instanceof ApiError && (vehicle.error.status === 404 || vehicle.error.status === 422)
    return (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
        title={notFound ? 'Veículo não encontrado' : 'Não foi possível carregar o veículo'}
        description={notFound ? 'Ele pode ter sido excluído ou o endereço está incorreto.' : apiErrorMessage(vehicle.error)}
        action={
          notFound ? (
            <Link
              to="/veiculos"
              className="inline-flex min-h-11 items-center gap-2 rounded-controle border border-linha bg-superficie px-4 font-semibold text-tinta shadow-controle hover:bg-fundo"
            >
              <ArrowLeft aria-hidden="true" size={18} />
              Voltar para veículos
            </Link>
          ) : (
            <Button onClick={() => void vehicle.refetch()}>Tentar de novo</Button>
          )
        }
      />
    )
  }
  return <Detail vehicle={vehicle.data} />
}

function Detail({ vehicle }: { vehicle: VehicleDetail }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canWrite = can('admin', 'reception')
  const remove = useDeleteVehicle()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function onDelete() {
    try {
      await remove.mutateAsync(vehicle.id)
      toast.success('Veículo excluído')
      setConfirming(false)
      navigate('/veiculos', { replace: true })
    } catch (error) {
      setConfirmError(apiErrorMessage(error))
    }
  }

  return (
    <>
      <Link
        to="/veiculos"
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-md text-corpo font-medium text-tinta-suave hover:text-azul"
      >
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={2} />
        Voltar para veículos
      </Link>
      <PageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={`${vehicle.year} · ${vehicle.color}`}
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
        <Card as="section" accent="violeta" aria-labelledby="veiculo-resumo">
          <CardHeader>
            <CardTitle as="h2" id="veiculo-resumo">
              Resumo
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-start gap-4">
              <Plate value={vehicle.plate} size="lg" />
              <p className="font-display text-titulo font-bold text-navy tabular-nums">
                {kmFormat.format(vehicle.current_km)} km
              </p>
              <p className="text-corpo text-tinta-suave">Quilometragem atual</p>
            </div>
          </CardBody>
        </Card>

        <Card as="section" className="lg:col-span-2" aria-labelledby="veiculo-dados">
          <CardHeader>
            <CardTitle as="h2" id="veiculo-dados">
              Dados do veículo
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Info label="Proprietário">
                {vehicle.customer ? (
                  <Link to={`/clientes/${vehicle.customer.id}`} className="font-semibold text-azul hover:underline">
                    {vehicle.customer.name}
                  </Link>
                ) : (
                  NONE
                )}
              </Info>
              <Info label="Combustível">{FUEL_LABELS[vehicle.fuel]}</Info>
              <Info label="Motor">{vehicle.engine ?? NONE}</Info>
              <Info label="Cor">{vehicle.color}</Info>
              <Info label="Chassi">{vehicle.chassis ? <span className="tabular-nums">{vehicle.chassis}</span> : NONE}</Info>
              <Info label="Renavam">{vehicle.renavam ?? NONE}</Info>
            </dl>
          </CardBody>
        </Card>
      </div>

      {canWrite && <VehicleFormDialog open={editing} vehicle={vehicle} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirming}
        destructive
        loading={remove.isPending}
        title="Excluir veículo?"
        confirmLabel="Excluir"
        description={
          <>
            <p>{`${vehicle.brand} ${vehicle.model} (${vehicle.plate}) será removido do cadastro. Esta ação não pode ser desfeita.`}</p>
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
