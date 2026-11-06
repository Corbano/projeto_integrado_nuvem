import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { ApiError } from '../../shared/api/errors'
import type { Role, User } from '../../shared/api/types'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { Button, Dialog, Field, Input, Select, useToast } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { useCreateUser, useUpdateUser } from './api'
import type { UpdateUserInput } from './api'
import { ROLE_LABELS, ROLE_OPTIONS } from './roleLabels'

export interface UserFormDialogProps {
  open: boolean
  /** Usuário em edição; ausente = criar. */
  user?: User | null
  /** O administrador logado: ele não pode alterar o próprio perfil nem se desativar. */
  currentUserId?: User['id']
  onClose: () => void
}

type FieldName = 'name' | 'email' | 'password' | 'role'
type Errors = Partial<Record<FieldName, string>>

const FIELD_NAMES: FieldName[] = ['name', 'email', 'password', 'role']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 16 px no celular evita o zoom automático dos campos no iOS. */
const MOBILE_FIELD = 'max-sm:text-[16px]'

function passwordStrength(password: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { score: 0, label: '' }
  let points = 0
  if (password.length >= 8) points++
  if (password.length >= 12) points++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) points++
  if (password.length < 8 || points <= 1) return { score: 1, label: 'Fraca' }
  if (points === 2 || points === 3) return { score: 2, label: 'Média' }
  return { score: 3, label: 'Forte' }
}

function validate(values: { name: string; email: string; password: string }, editing: boolean): Errors {
  const errors: Errors = {}
  if (!values.name.trim()) errors.name = 'Informe o nome.'
  if (!editing) {
    if (!values.email.trim()) errors.email = 'Informe o e-mail.'
    else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Informe um e-mail válido, como nome@empresa.com.'
  }
  if (!editing || values.password) {
    if (!values.password) errors.password = 'Informe a senha.'
    else if (values.password.length < 8 || values.password.length > 72)
      errors.password = 'A senha deve ter de 8 a 72 caracteres.'
  }
  return errors
}

/** Separa o erro do servidor em mensagens por campo e uma mensagem geral (regras de negócio). */
function mapServerError(error: unknown): { fields: Errors; general?: string } {
  if (!(error instanceof ApiError)) return { fields: {}, general: 'Não foi possível salvar. Tente de novo.' }
  if (error.status === 409) return { fields: { email: error.message || 'E-mail já cadastrado' } }
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

export function UserFormDialog({ open, user, currentUserId, onClose }: UserFormDialogProps) {
  const sheet = useMediaQuery('(max-width: 639px)')
  const editing = Boolean(user)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Editar usuário' : 'Novo usuário'}
      variant={sheet ? 'sheet' : 'center'}
    >
      <UserForm
        key={user?.id ?? 'new'}
        user={user ?? null}
        isSelf={Boolean(user) && user?.id === currentUserId}
        onClose={onClose}
      />
    </Dialog>
  )
}

function UserForm({ user, isSelf, onClose }: { user: User | null; isSelf: boolean; onClose: () => void }) {
  const editing = user !== null
  const toast = useToast()
  const create = useCreateUser()
  const update = useUpdateUser()
  const pending = create.isPending || update.isPending
  const switchId = useId()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'reception')
  const [active, setActive] = useState(user?.active ?? true)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [general, setGeneral] = useState<string | undefined>()

  const strength = passwordStrength(password)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validate({ name, email, password }, editing)
    setErrors(found)
    setGeneral(undefined)
    if (Object.keys(found).length > 0) {
      const first = FIELD_NAMES.find((key) => found[key])
      if (first) document.getElementById(`user-form-${first}`)?.focus()
      return
    }
    try {
      if (user) {
        const changes: UpdateUserInput = {}
        if (name.trim() !== user.name) changes.name = name.trim()
        if (role !== user.role) changes.role = role
        if (active !== user.active) changes.active = active
        if (password) changes.password = password
        if (Object.keys(changes).length > 0) {
          await update.mutateAsync({ id: user.id, input: changes })
          toast.success(changes.active === false ? 'Usuário desativado' : 'Usuário atualizado')
        }
      } else {
        await create.mutateAsync({ name: name.trim(), email: email.trim(), password, role })
        toast.success('Usuário criado')
      }
      onClose()
    } catch (error) {
      const mapped = mapServerError(error)
      setErrors(mapped.fields)
      setGeneral(mapped.general)
      const first = FIELD_NAMES.find((key) => mapped.fields[key])
      if (first) document.getElementById(`user-form-${first}`)?.focus()
    }
  }

  const selfHint = 'Você não pode alterar o próprio perfil nem se desativar.'

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
          id="user-form-name"
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
        label="E-mail"
        required={!editing}
        error={errors.email}
        hint={editing ? 'O e-mail não pode ser alterado.' : undefined}
      >
        <Input
          id="user-form-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={editing}
          className={MOBILE_FIELD}
        />
      </Field>

      <Field label="Perfil" required error={errors.role} hint={isSelf ? selfHint : undefined}>
        <Select
          id="user-form-role"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          disabled={isSelf}
          className={MOBILE_FIELD}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <Field
          label={editing ? 'Nova senha' : 'Senha'}
          required={!editing}
          error={errors.password}
          hint={editing ? 'Deixe em branco para manter a senha atual. De 8 a 72 caracteres.' : 'De 8 a 72 caracteres.'}
        >
          <Input
            id="user-form-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={72}
            className={MOBILE_FIELD}
            trailing={
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
                className="inline-flex size-10 items-center justify-center rounded-controle text-tinta-suave hover:bg-fundo hover:text-tinta"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            }
          />
        </Field>
        {password && (
          <div className="mt-2 flex items-center gap-3" aria-live="polite">
            <div aria-hidden="true" className="flex flex-1 gap-1.5">
              {[1, 2, 3].map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    'h-1.5 flex-1 rounded-pilula',
                    segment > strength.score
                      ? 'bg-linha'
                      : strength.score === 1
                        ? 'bg-critico'
                        : strength.score === 2
                          ? 'bg-atencao'
                          : 'bg-ok',
                  )}
                />
              ))}
            </div>
            <span className="text-mini font-medium text-tinta-suave">Força: {strength.label}</span>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex items-center justify-between gap-4 rounded-controle border border-linha bg-fundo px-3.5 py-3">
          <div className="min-w-0">
            <label htmlFor={switchId} className="block text-corpo font-semibold text-tinta">
              Usuário ativo
            </label>
            <p id={`${switchId}-hint`} className="text-mini text-tinta-suave">
              {isSelf ? selfHint : 'Quem está inativo não consegue entrar no sistema.'}
            </p>
          </div>
          <button
            id={switchId}
            type="button"
            role="switch"
            aria-checked={active}
            aria-describedby={`${switchId}-hint`}
            disabled={isSelf}
            onClick={() => setActive((value) => !value)}
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-55',
              active ? 'border-azul bg-azul' : 'border-borda-campo bg-borda-campo',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'inline-block size-5 rounded-full bg-white shadow-controle transition-transform',
                active ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? 'Salvar alterações' : 'Criar usuário'}
        </Button>
      </div>
    </form>
  )
}
