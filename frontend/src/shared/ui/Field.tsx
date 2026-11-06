import { Children, cloneElement, isValidElement, useId } from 'react'
import type { ReactElement, ReactNode } from 'react'

export interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  /**
   * Exatamente um elemento filho (Input, Select...). Field MESCLA seus props com os do filho:
   * aria-describedby (uniao), aria-invalid (do filho ou invalido) e required (OU); mantem o id do filho.
   * Formularios que usam `required` devem pôr `noValidate` no <form>: a validacao e feita no React.
   */
  children: ReactElement
  className?: string
}

interface ControlProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling'
  required?: boolean
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const uid = useId()
  const only = Children.only(children) as ReactElement<ControlProps>
  const own = isValidElement<ControlProps>(only) ? only.props : {}
  const id = own.id ?? `field-${uid}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const ids = [...(own['aria-describedby']?.split(/\s+/) ?? []), hintId, errorId].filter(
    (value): value is string => Boolean(value),
  )
  const describedBy = ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined

  const control: ReactNode = cloneElement(only, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : own['aria-invalid'],
    required: required || own.required || undefined,
  })

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-corpo font-medium text-chassi">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-freio-texto">
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-mini text-chassi-suave">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-mini font-medium text-freio-texto">
          {error}
        </p>
      )}
    </div>
  )
}
