import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, CircleAlert, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../shared/api/errors'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Plate,
  Select,
  Skeleton,
  StatusPill,
  useToast,
} from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { controlClasses } from '../../shared/ui/Input'
import { useAuth } from '../auth/useAuth'
import {
  apiErrorMessage,
  canTransition,
  formatDate,
  formatMoney,
  KIND_LABELS,
  STATUS_LABELS,
  TRANSITIONS,
  useAddItem,
  useChangeStatus,
  useDeleteItem,
  useDeleteOrder,
  useOrder,
  useUpdateOrder,
} from './api'
import type { ItemKind, OrderDetail } from './api'
import { STATUS_TONE } from './OrdersPage'

const MOBILE_FIELD = 'max-sm:text-[16px]'

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-mini font-semibold text-tinta-suave">{label}</dt>
      <dd className="mt-1 text-corpo break-words text-tinta">{children}</dd>
    </div>
  )
}

const NONE = <span className="text-tinta-suave">Não informado</span>

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const order = useOrder(id)
  useDocumentTitle(order.data ? `Ordem ${order.data.number}` : 'Ordem de serviço')

  if (order.isPending) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Carregando ordem</span>
        <Skeleton className="mb-8 h-9 w-72" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    )
  }
  if (order.isError || !order.data) {
    const notFound = order.error instanceof ApiError && [403, 404, 422].includes(order.error.status)
    return (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
        title={notFound ? 'Ordem não encontrada' : 'Não foi possível carregar a ordem'}
        description={notFound ? 'Ela pode ter sido excluída ou você não tem acesso.' : apiErrorMessage(order.error)}
        action={
          notFound ? (
            <Link
              to="/ordens-de-servico"
              className="inline-flex min-h-11 items-center gap-2 rounded-controle border border-linha bg-superficie px-4 font-semibold text-tinta shadow-controle hover:bg-fundo"
            >
              <ArrowLeft aria-hidden="true" size={18} />
              Voltar para ordens
            </Link>
          ) : (
            <Button onClick={() => void order.refetch()}>Tentar de novo</Button>
          )
        }
      />
    )
  }
  return <Detail order={order.data} />
}

function Detail({ order }: { order: OrderDetail }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const change = useChangeStatus()
  const remove = useDeleteOrder()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const itemsLocked = order.status === 'finalizada' || order.status === 'entregue'
  const next = TRANSITIONS[order.status].filter((to) => canTransition(user?.role, order.status, to))

  async function move(to: (typeof next)[number]) {
    setError(null)
    try {
      await change.mutateAsync({ id: order.id, to })
      toast.success(`Status: ${STATUS_LABELS[to]}`)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync(order.id)
      toast.success('Ordem excluída')
      navigate('/ordens-de-servico', { replace: true })
    } catch (e) {
      setError(apiErrorMessage(e))
      setConfirming(false)
    }
  }

  return (
    <>
      <Link
        to="/ordens-de-servico"
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-md text-corpo font-medium text-tinta-suave hover:text-azul"
      >
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={2} />
        Voltar para ordens
      </Link>
      <PageHeader
        title={`Ordem ${order.number}`}
        subtitle={STATUS_LABELS[order.status]}
        actions={
          <>
            {next.map((to, index) => (
              <Button key={to} variant={index === 0 ? 'primary' : 'outline'} loading={change.isPending} onClick={() => void move(to)}>
                {to === 'aguardando_orcamento' && order.status === 'aguardando_aprovacao'
                  ? 'Voltar para orçamento'
                  : `Avançar: ${STATUS_LABELS[to]}`}
              </Button>
            ))}
            {!itemsLocked && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Editar
              </Button>
            )}
            {can('admin') && (
              <Button variant="outline" className="text-critico-texto" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden="true" />
                Excluir
              </Button>
            )}
          </>
        }
      />
      {error && (
        <p role="alert" className="mb-4 rounded-controle border border-critico/30 bg-critico-fundo px-3.5 py-3 font-medium text-critico-texto">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card as="section" accent="ciano" aria-labelledby="os-dados">
          <CardHeader>
            <CardTitle as="h2" id="os-dados">
              Dados
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-5">
              <Info label="Status">
                <StatusPill variant={STATUS_TONE[order.status]}>{STATUS_LABELS[order.status]}</StatusPill>
              </Info>
              <Info label="Veículo">
                {order.vehicle ? (
                  <Link to={`/veiculos/${order.vehicle.id}`} className="flex flex-col items-start gap-1.5 hover:text-azul">
                    <Plate value={order.vehicle.plate} />
                    <span>
                      {order.vehicle.brand} {order.vehicle.model}
                    </span>
                  </Link>
                ) : (
                  NONE
                )}
              </Info>
              <Info label="Cliente">
                {order.customer ? (
                  <Link to={`/clientes/${order.customer.id}`} className="font-semibold text-azul hover:underline">
                    {order.customer.name}
                  </Link>
                ) : (
                  NONE
                )}
              </Info>
              <Info label="Mecânico">{order.mechanic?.name ?? NONE}</Info>
              <Info label="Prazo">{order.due_date ? formatDate(order.due_date) : NONE}</Info>
              <Info label="Problema relatado">
                <p className="whitespace-pre-line">{order.reported_issue}</p>
              </Info>
              <Info label="Diagnóstico">
                {order.diagnosis ? <p className="whitespace-pre-line">{order.diagnosis}</p> : NONE}
              </Info>
            </dl>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <ItemsCard order={order} locked={itemsLocked} />
          <Card as="section" aria-labelledby="os-historico">
            <CardHeader>
              <CardTitle as="h2" id="os-historico">
                Histórico
              </CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="flex flex-col gap-3">
                {[...order.history].reverse().map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-corpo">
                    <span>
                      {h.from_status ? `${STATUS_LABELS[h.from_status]} → ` : 'Aberta como '}
                      <strong className="text-navy">{STATUS_LABELS[h.to_status]}</strong>
                    </span>
                    <span className="text-mini text-tinta-suave">
                      {h.changed_at ? new Date(h.changed_at).toLocaleString('pt-BR') : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <EditDialog open={editing} order={order} onClose={() => setEditing(false)} />

      <ConfirmDialog
        open={confirming}
        destructive
        loading={remove.isPending}
        title="Excluir ordem?"
        confirmLabel="Excluir"
        description={<p>{`A ordem ${order.number} será removida. Esta ação não pode ser desfeita.`}</p>}
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

function ItemsCard({ order, locked }: { order: OrderDetail; locked: boolean }) {
  const toast = useToast()
  const add = useAddItem(order.id)
  const del = useDeleteItem(order.id)
  const [kind, setKind] = useState<ItemKind>('service')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    const q = qty.trim().replace(',', '.')
    const p = price.trim().replace(',', '.')
    if (!description.trim()) return setError('Informe a descrição.')
    if (!/^\d{1,4}(\.\d{1,3})?$/.test(q) || Number(q) <= 0) return setError('Quantidade inválida.')
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(p)) return setError('Informe o valor unitário, como 80,00.')
    setError(null)
    try {
      await add.mutateAsync({ kind, description: description.trim(), qty: q, unit_price: p })
      setDescription('')
      setQty('1')
      setPrice('')
      toast.success('Item adicionado')
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <Card as="section" aria-labelledby="os-itens">
      <CardHeader>
        <CardTitle as="h2" id="os-itens">
          Peças e serviços
        </CardTitle>
      </CardHeader>
      <CardBody>
        {order.items.length === 0 ? (
          <p className="text-corpo text-tinta-suave">Nenhum item lançado.</p>
        ) : (
          <ul aria-label="Itens da ordem" className="divide-y divide-linha">
            {order.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-semibold text-navy">{item.description}</p>
                  <p className="text-mini text-tinta-suave">
                    {KIND_LABELS[item.kind]} · {Number(item.qty).toLocaleString('pt-BR')} × {formatMoney(item.unit_price)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatMoney(item.line_total)}</span>
                {!locked && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Remover ${item.description}`}
                    onClick={() => del.mutate(item.id, { onError: (e) => setError(apiErrorMessage(e)) })}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-4 space-y-1 border-t border-linha pt-4 text-corpo">
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Mão de obra</dt>
            <dd className="tabular-nums">{formatMoney(order.labor_cost)}</dd>
          </div>
          <div className="flex justify-between text-destaque font-bold text-navy">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.total)}</dd>
          </div>
        </dl>

        {!locked && (
          <form noValidate onSubmit={onAdd} className="mt-5 grid gap-3 border-t border-linha pt-5 sm:grid-cols-6" aria-label="Adicionar item">
            <Field label="Tipo" className="sm:col-span-1">
              <Select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)} className={MOBILE_FIELD}>
                <option value="service">Serviço</option>
                <option value="part">Peça</option>
              </Select>
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className={MOBILE_FIELD} />
            </Field>
            <Field label="Qtd." className="sm:col-span-1">
              <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={MOBILE_FIELD} />
            </Field>
            <Field label="Valor un. (R$)" className="sm:col-span-1">
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={MOBILE_FIELD} />
            </Field>
            <div className="flex items-end sm:col-span-1">
              <Button type="submit" loading={add.isPending} className="w-full">
                <Plus aria-hidden="true" />
                Adicionar
              </Button>
            </div>
            {error && (
              <p role="alert" className="font-medium text-critico-texto sm:col-span-6">
                {error}
              </p>
            )}
          </form>
        )}
      </CardBody>
    </Card>
  )
}

function EditDialog({ open, order, onClose }: { open: boolean; order: OrderDetail; onClose: () => void }) {
  const sheet = useMediaQuery('(max-width: 639px)')
  return (
    <Dialog open={open} onClose={onClose} title={`Editar ordem ${order.number}`} variant={sheet ? 'sheet' : 'center'}>
      <EditForm key={order.updated_at ?? order.id} order={order} onClose={onClose} />
    </Dialog>
  )
}

function EditForm({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const toast = useToast()
  const update = useUpdateOrder(order.id)
  const [issue, setIssue] = useState(order.reported_issue)
  const [diagnosis, setDiagnosis] = useState(order.diagnosis ?? '')
  const [labor, setLabor] = useState(order.labor_cost.replace('.', ','))
  const [due, setDue] = useState(order.due_date ?? '')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const laborValue = labor.trim().replace(',', '.')
    if (!issue.trim()) return setError('Descreva o problema relatado.')
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(laborValue)) return setError('Mão de obra inválida.')
    try {
      await update.mutateAsync({
        reported_issue: issue.trim(),
        diagnosis: diagnosis.trim() || null,
        labor_cost: laborValue,
        due_date: due || null,
      })
      toast.success('Ordem atualizada')
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-controle border border-critico/30 bg-critico-fundo px-3.5 py-3 font-medium text-critico-texto">
          {error}
        </p>
      )}
      <Field label="Problema relatado" required>
        <textarea rows={3} maxLength={4000} value={issue} onChange={(e) => setIssue(e.target.value)} className={cn(controlClasses, 'min-h-24 resize-y py-2.5', MOBILE_FIELD)} />
      </Field>
      <Field label="Diagnóstico">
        <textarea rows={3} maxLength={4000} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={cn(controlClasses, 'min-h-24 resize-y py-2.5', MOBILE_FIELD)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mão de obra (R$)">
          <Input inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value)} className={MOBILE_FIELD} />
        </Field>
        <Field label="Prazo">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={MOBILE_FIELD} />
        </Field>
      </div>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={update.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={update.isPending}>
          Salvar alterações
        </Button>
      </div>
    </form>
  )
}
