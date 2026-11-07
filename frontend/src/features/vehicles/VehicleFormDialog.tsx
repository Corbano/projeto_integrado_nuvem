import { useState } from 'react'
import type { FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ApiError } from '../../shared/api/errors'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { Button, Dialog, Field, Input, Select, useToast } from '../../shared/ui'
import { isValidPlate, normalizePlate } from '../../shared/ui/plateFormat'
import { CustomerCombobox } from '../customers/CustomerCombobox'
import type { CustomerSummary } from '../customers/api'
import { FUELS, FUEL_LABELS, useCreateVehicle, useUpdateVehicle } from './api'
import type { Fuel, UpdateVehicleInput, Vehicle } from './api'

export interface VehicleFormDialogProps {
  open: boolean
  vehicle?: Vehicle | null
  /** Proprietário pré-escolhido ao cadastrar (vindo do detalhe do cliente). */
  initialCustomerId?: number | null
  onClose: () => void
  onSaved?: (vehicle: Vehicle) => void
}

type FieldName =
  | 'customer_id'
  | 'plate'
  | 'brand'
  | 'model'
  | 'year'
  | 'engine'
  | 'fuel'
  | 'color'
  | 'chassis'
  | 'renavam'
type Errors = Partial<Record<FieldName, string>>
const FIELD_NAMES: FieldName[] = [
  'customer_id',
  'plate',
  'brand',
  'model',
  'year',
  'engine',
  'fuel',
  'color',
  'chassis',
  'renavam',
]
const MOBILE_FIELD = 'max-sm:text-[16px]'
const CHASSIS_RE = /^[A-HJ-NPR-Z0-9]{17}$/

function mapServerError(error: unknown): { fields: Errors; general?: string } {
  if (!(error instanceof ApiError)) return { fields: {}, general: 'Não foi possível salvar. Tente de novo.' }
  if (error.status === 409) {
    const field: FieldName = /chassi/i.test(error.message) ? 'chassis' : /renavam/i.test(error.message) ? 'renavam' : 'plate'
    return { fields: { [field]: error.message || 'Já cadastrado' } }
  }
  if (error.status === 422 && error.details?.length) {
    const fields: Errors = {}
    const leftovers: string[] = []
    for (const detail of error.details) {
      const key = [...detail.loc].reverse().find((part): part is string => typeof part === 'string')
      if (key && (FIELD_NAMES as string[]).includes(key) && !fields[key as FieldName]) fields[key as FieldName] = detail.msg
      else leftovers.push(detail.msg)
    }
    return { fields, general: leftovers.length > 0 ? leftovers.join(' ') : undefined }
  }
  return { fields: {}, general: error.message }
}

export function VehicleFormDialog({ open, vehicle, initialCustomerId, onClose, onSaved }: VehicleFormDialogProps) {
  const sheet = useMediaQuery('(max-width: 639px)')
  return (
    <Dialog open={open} onClose={onClose} title={vehicle ? 'Editar veículo' : 'Novo veículo'} variant={sheet ? 'sheet' : 'center'}>
      <VehicleForm
        key={vehicle?.id ?? 'new'}
        vehicle={vehicle ?? null}
        initialCustomerId={initialCustomerId ?? null}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Dialog>
  )
}

function VehicleForm({
  vehicle,
  initialCustomerId,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle | null
  initialCustomerId: number | null
  onClose: () => void
  onSaved?: (vehicle: Vehicle) => void
}) {
  const toast = useToast()
  const create = useCreateVehicle()
  const update = useUpdateVehicle()
  const pending = create.isPending || update.isPending

  const [owner, setOwner] = useState<CustomerSummary | null>(null)
  const [plate, setPlate] = useState(vehicle ? normalizePlate(vehicle.plate) : '')
  const [brand, setBrand] = useState(vehicle?.brand ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [year, setYear] = useState(vehicle ? String(vehicle.year) : '')
  const [engine, setEngine] = useState(vehicle?.engine ?? '')
  const [fuel, setFuel] = useState<Fuel>(vehicle?.fuel ?? 'flex')
  const [color, setColor] = useState(vehicle?.color ?? '')
  const [chassis, setChassis] = useState(vehicle?.chassis ?? '')
  const [renavam, setRenavam] = useState(vehicle?.renavam ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [general, setGeneral] = useState<string | undefined>()

  const ownerId = owner?.id ?? null

  function validate(): Errors {
    const found: Errors = {}
    if (!ownerId) found.customer_id = 'Escolha o proprietário.'
    if (!isValidPlate(plate)) found.plate = 'Placa inválida (use ABC-1234 ou ABC1D23).'
    if (!brand.trim()) found.brand = 'Informe a marca.'
    if (!model.trim()) found.model = 'Informe o modelo.'
    const y = Number(year)
    const maxYear = new Date().getFullYear() + 1
    if (!/^\d{4}$/.test(year) || y < 1900 || y > maxYear) found.year = `Informe um ano entre 1900 e ${maxYear}.`
    if (!color.trim()) found.color = 'Informe a cor.'
    if (chassis.trim() && !CHASSIS_RE.test(chassis.trim().toUpperCase())) found.chassis = 'Chassi com 17 caracteres, sem I, O e Q.'
    if (renavam.trim() && !/^\d{9,11}$/.test(renavam.trim())) found.renavam = 'Renavam deve ter de 9 a 11 dígitos.'
    return found
  }

  function focusFirst(found: Errors) {
    const first = FIELD_NAMES.find((key) => found[key])
    if (first) window.document.getElementById(`vehicle-form-${first}`)?.focus()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validate()
    setErrors(found)
    setGeneral(undefined)
    if (Object.keys(found).length > 0) return focusFirst(found)
    const clean = {
      plate: normalizePlate(plate).replace('-', ''),
      brand: brand.trim(),
      model: model.trim(),
      year: Number(year),
      engine: engine.trim() || null,
      fuel,
      color: color.trim(),
      chassis: chassis.trim().toUpperCase() || null,
      renavam: renavam.trim() || null,
    }
    try {
      let saved: Vehicle
      if (vehicle) {
        const changes: UpdateVehicleInput = {}
        if (ownerId && ownerId !== vehicle.customer_id) changes.customer_id = ownerId
        if (clean.plate !== vehicle.plate.replace('-', '')) changes.plate = clean.plate
        if (clean.brand !== vehicle.brand) changes.brand = clean.brand
        if (clean.model !== vehicle.model) changes.model = clean.model
        if (clean.year !== vehicle.year) changes.year = clean.year
        if (clean.engine !== vehicle.engine) changes.engine = clean.engine
        if (clean.fuel !== vehicle.fuel) changes.fuel = clean.fuel
        if (clean.color !== vehicle.color) changes.color = clean.color
        if (clean.chassis !== vehicle.chassis) changes.chassis = clean.chassis
        if (clean.renavam !== vehicle.renavam) changes.renavam = clean.renavam
        if (Object.keys(changes).length > 0) {
          saved = await update.mutateAsync({ id: vehicle.id, input: changes })
          toast.success('Veículo atualizado')
        } else {
          saved = vehicle
        }
      } else {
        saved = await create.mutateAsync({ customer_id: ownerId as number, ...clean })
        toast.success('Veículo cadastrado')
      }
      onSaved?.(saved)
      onClose()
    } catch (error) {
      const mapped = mapServerError(error)
      setErrors(mapped.fields)
      setGeneral(mapped.general)
      focusFirst(mapped.fields)
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

      <CustomerCombobox
        id="vehicle-form-customer_id"
        label="Proprietário"
        required
        value={owner}
        onChange={setOwner}
        initialCustomerId={vehicle?.customer_id ?? initialCustomerId}
        error={errors.customer_id}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Placa" required error={errors.plate}>
          <Input
            id="vehicle-form-plate"
            value={plate}
            onChange={(e) => setPlate(normalizePlate(e.target.value).slice(0, 8))}
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="next"
            placeholder="ABC1D23"
            className={MOBILE_FIELD}
            data-autofocus
          />
        </Field>
        <Field label="Ano" required error={errors.year}>
          <Input
            id="vehicle-form-year"
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
            autoComplete="off"
            enterKeyHint="next"
            className={MOBILE_FIELD}
          />
        </Field>
        <Field label="Marca" required error={errors.brand}>
          <Input id="vehicle-form-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={60} autoComplete="off" autoCapitalize="words" enterKeyHint="next" className={MOBILE_FIELD} />
        </Field>
        <Field label="Modelo" required error={errors.model}>
          <Input id="vehicle-form-model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={60} autoComplete="off" autoCapitalize="words" enterKeyHint="next" className={MOBILE_FIELD} />
        </Field>
        <Field label="Cor" required error={errors.color}>
          <Input id="vehicle-form-color" value={color} onChange={(e) => setColor(e.target.value)} maxLength={40} autoComplete="off" enterKeyHint="next" className={MOBILE_FIELD} />
        </Field>
        <Field label="Combustível" required error={errors.fuel}>
          <Select id="vehicle-form-fuel" value={fuel} onChange={(e) => setFuel(e.target.value as Fuel)} className={MOBILE_FIELD}>
            {FUELS.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Motor" error={errors.engine} hint="Ex.: 1.0 turbo.">
          <Input id="vehicle-form-engine" value={engine} onChange={(e) => setEngine(e.target.value)} maxLength={60} autoComplete="off" enterKeyHint="next" className={MOBILE_FIELD} />
        </Field>
        <Field label="Renavam" error={errors.renavam}>
          <Input id="vehicle-form-renavam" inputMode="numeric" maxLength={11} value={renavam} onChange={(e) => setRenavam(e.target.value.replace(/\D/g, ''))} autoComplete="off" enterKeyHint="next" className={MOBILE_FIELD} />
        </Field>
      </div>
      <Field label="Chassi" error={errors.chassis} hint="17 caracteres.">
        <Input id="vehicle-form-chassis" value={chassis} onChange={(e) => setChassis(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))} autoComplete="off" autoCapitalize="characters" enterKeyHint="done" className={MOBILE_FIELD} />
      </Field>

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {vehicle ? 'Salvar alterações' : 'Cadastrar veículo'}
        </Button>
      </div>
    </form>
  )
}
