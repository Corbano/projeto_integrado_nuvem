import { useState } from 'react'
import type { FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../../shared/api/errors'
import { apiFetch } from '../../shared/api/client'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { Button, Dialog, Field, Input, Select, useToast } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { controlClasses } from '../../shared/ui/Input'
import { useAuth } from '../auth/useAuth'
import { VehicleCombobox } from '../vehicles/VehicleCombobox'
import type { Vehicle } from '../vehicles/api'
import { useCreateOrder } from './api'
import type { OrderDetail } from './api'
import type { UserList } from '../users/api'

const MOBILE_FIELD = 'max-sm:text-[16px]'

export interface OrderFormDialogProps {
  open: boolean
  onClose: () => void
  onSaved?: (order: OrderDetail) => void
}

/** Só o administrador pode listar usuários; os demais perfis criam a ordem sem mecânico. */
function useMechanics(enabled: boolean) {
  return useQuery({
    queryKey: ['users', 'mechanics'],
    enabled,
    staleTime: 60_000,
    queryFn: ({ signal }) => apiFetch<UserList>('/users?page=1&size=100', { signal }),
    select: (data) => data.items.filter((u) => u.role === 'mechanic' && u.active),
  })
}

export function OrderFormDialog({ open, onClose, onSaved }: OrderFormDialogProps) {
  const sheet = useMediaQuery('(max-width: 639px)')
  return (
    <Dialog open={open} onClose={onClose} title="Nova ordem de serviço" variant={sheet ? 'sheet' : 'center'}>
      <OrderForm onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}

function OrderForm({ onClose, onSaved }: { onClose: () => void; onSaved?: (order: OrderDetail) => void }) {
  const toast = useToast()
  const { can } = useAuth()
  const create = useCreateOrder()
  const mechanics = useMechanics(can('admin'))

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [mechanicId, setMechanicId] = useState('')
  const [issue, setIssue] = useState('')
  const [labor, setLabor] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | undefined>()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (create.isPending) return
    const found: Record<string, string> = {}
    if (!vehicle) found.vehicle = 'Escolha o veículo.'
    if (!issue.trim()) found.issue = 'Descreva o problema relatado.'
    const laborValue = labor.trim().replace(',', '.')
    if (laborValue && !/^\d{1,6}(\.\d{1,2})?$/.test(laborValue)) found.labor = 'Informe um valor como 150,00.'
    setErrors(found)
    setGeneral(undefined)
    if (Object.keys(found).length > 0) return
    try {
      const saved = await create.mutateAsync({
        vehicle_id: (vehicle as Vehicle).id,
        reported_issue: issue.trim(),
        mechanic_id: mechanicId ? Number(mechanicId) : null,
        labor_cost: laborValue || '0.00',
        due_date: dueDate || null,
      })
      toast.success(`Ordem ${saved.number} aberta`)
      onSaved?.(saved)
      onClose()
    } catch (error) {
      setGeneral(error instanceof ApiError ? error.message : 'Não foi possível salvar. Tente de novo.')
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {general && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-controle border border-critico/30 bg-critico-fundo px-3.5 py-3 text-corpo font-medium text-critico-texto"
        >
          <TriangleAlert aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>{general}</span>
        </div>
      )}
      <VehicleCombobox required value={vehicle} onChange={setVehicle} error={errors.vehicle} />
      <Field label="Problema relatado" required error={errors.issue}>
        <textarea
          rows={3}
          maxLength={4000}
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          className={cn(controlClasses, 'min-h-24 resize-y py-2.5', MOBILE_FIELD)}
          data-autofocus
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mão de obra (R$)" error={errors.labor}>
          <Input inputMode="decimal" placeholder="0,00" value={labor} onChange={(e) => setLabor(e.target.value)} className={MOBILE_FIELD} />
        </Field>
        <Field label="Prazo">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={MOBILE_FIELD} />
        </Field>
      </div>
      {can('admin') && (
        <Field label="Mecânico responsável">
          <Select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className={MOBILE_FIELD}>
            <option value="">Sem mecânico por enquanto</option>
            {(mechanics.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={create.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={create.isPending}>
          Abrir ordem
        </Button>
      </div>
    </form>
  )
}
