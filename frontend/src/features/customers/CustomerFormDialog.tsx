import { useState } from 'react'
import type { FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import { ApiError } from '../../shared/api/errors'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { Button, Dialog, Field, Input, useToast } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { controlClasses } from '../../shared/ui/Input'
import { useCreateCustomer, useUpdateCustomer } from './api'
import type { Customer, UpdateCustomerInput } from './api'
import { documentType, formatDocument, formatPhone, onlyDigits, validateDocument, validatePhone } from './format'

export interface CustomerPrefill {
  name?: string
  document?: string
}

export interface CustomerFormDialogProps {
  open: boolean
  /** Cliente em edição; ausente = cadastrar. */
  customer?: Customer | null
  /** Valores iniciais ao cadastrar (ex.: texto digitado no autocompletar). */
  prefill?: CustomerPrefill
  onClose: () => void
  /** Chamado com o cliente salvo, antes de fechar. */
  onSaved?: (customer: Customer) => void
}

type FieldName = 'name' | 'document' | 'phone' | 'email' | 'notes'
type Errors = Partial<Record<FieldName, string>>

const FIELD_NAMES: FieldName[] = ['name', 'document', 'phone', 'email', 'notes']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 16 px no celular evita o zoom automático dos campos no iOS. */
const MOBILE_FIELD = 'max-sm:text-[16px]'

function validate(values: { name: string; document: string; phone: string; email: string }): Errors {
  const errors: Errors = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Informe o nome.'
  else if (name.length < 2) errors.name = 'O nome deve ter ao menos 2 caracteres.'
  const document = validateDocument(values.document)
  if (document) errors.document = document
  const phone = validatePhone(values.phone)
  if (phone) errors.phone = phone
  const email = values.email.trim()
  if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Informe um e-mail válido, como nome@empresa.com.'
  return errors
}

/** Separa o erro do servidor em mensagens por campo e uma mensagem geral. */
function mapServerError(error: unknown): { fields: Errors; general?: string } {
  if (!(error instanceof ApiError)) return { fields: {}, general: 'Não foi possível salvar. Tente de novo.' }
  if (error.status === 409) return { fields: { document: error.message || 'Documento já cadastrado' } }
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

export function CustomerFormDialog({ open, customer, prefill, onClose, onSaved }: CustomerFormDialogProps) {
  const sheet = useMediaQuery('(max-width: 639px)')
  const editing = Boolean(customer)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Editar cliente' : 'Novo cliente'}
      variant={sheet ? 'sheet' : 'center'}
    >
      <CustomerForm
        key={customer?.id ?? 'new'}
        customer={customer ?? null}
        prefill={prefill}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Dialog>
  )
}

function CustomerForm({
  customer,
  prefill,
  onClose,
  onSaved,
}: {
  customer: Customer | null
  prefill?: CustomerPrefill
  onClose: () => void
  onSaved?: (customer: Customer) => void
}) {
  const editing = customer !== null
  const toast = useToast()
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const pending = create.isPending || update.isPending

  const [name, setName] = useState(customer?.name ?? prefill?.name ?? '')
  const [document, setDocument] = useState(formatDocument(customer?.document ?? prefill?.document ?? ''))
  const [phone, setPhone] = useState(formatPhone(customer?.phone ?? ''))
  const [email, setEmail] = useState(customer?.email ?? '')
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [general, setGeneral] = useState<string | undefined>()

  const type = documentType(document)
  const digits = onlyDigits(document)

  function focusFirst(found: Errors) {
    const first = FIELD_NAMES.find((key) => found[key])
    if (first) window.document.getElementById(`customer-form-${first}`)?.focus()
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validate({ name, document, phone, email })
    setErrors(found)
    setGeneral(undefined)
    if (Object.keys(found).length > 0) {
      focusFirst(found)
      return
    }
    const cleanName = name.trim()
    const cleanEmail = email.trim()
    const cleanNotes = notes.trim()
    const phoneDigits = onlyDigits(phone)
    try {
      let saved: Customer
      if (customer) {
        const changes: UpdateCustomerInput = {}
        if (cleanName !== customer.name) changes.name = cleanName
        if (digits !== customer.document) changes.document = digits
        if (phoneDigits !== (customer.phone ?? '')) changes.phone = phoneDigits || null
        if (cleanEmail !== (customer.email ?? '')) changes.email = cleanEmail || null
        if (cleanNotes !== (customer.notes ?? '')) changes.notes = cleanNotes || null
        if (Object.keys(changes).length > 0) {
          saved = await update.mutateAsync({ id: customer.id, input: changes })
          toast.success('Cliente atualizado')
        } else {
          saved = customer
        }
      } else {
        saved = await create.mutateAsync({
          name: cleanName,
          document: digits,
          phone: phoneDigits || null,
          email: cleanEmail || null,
          notes: cleanNotes || null,
        })
        toast.success('Cliente cadastrado')
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

      <Field label="Nome" required error={errors.name}>
        <Input
          id="customer-form-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={120}
          className={MOBILE_FIELD}
          data-autofocus
        />
      </Field>

      <Field
        label="CPF/CNPJ"
        required
        error={errors.document}
        hint={`Tipo detectado automaticamente: ${type}. Digite só os números.`}
      >
        <Input
          id="customer-form-document"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          placeholder={type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
          value={document}
          onChange={(event) => setDocument(formatDocument(event.target.value))}
          className={MOBILE_FIELD}
          trailing={
            <span
              data-testid="tipo-documento"
              className="mr-1 rounded-pilula bg-info-fundo px-2 py-0.5 text-legenda font-bold text-azul"
            >
              {type}
            </span>
          }
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefone" error={errors.phone} hint="Com DDD.">
          <Input
            id="customer-form-phone"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(event) => setPhone(formatPhone(event.target.value))}
            className={MOBILE_FIELD}
          />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <Input
            id="customer-form-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={MOBILE_FIELD}
          />
        </Field>
      </div>

      <Field label="Observações" error={errors.notes}>
        <textarea
          id="customer-form-notes"
          rows={3}
          maxLength={5000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={cn(controlClasses, 'min-h-24 resize-y py-2.5', MOBILE_FIELD)}
        />
      </Field>

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Button>
      </div>
    </form>
  )
}
