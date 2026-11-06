import { Children, cloneElement, isValidElement, useId } from 'react'
import type { ReactElement, ReactNode } from 'react'

export interface FieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  /** Um unico controle (Input, Select...). Recebe id, aria-describedby, aria-invalid e required. */
  children: ReactElement
  className?: string
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const uid = useId()
  const only = Children.only(children)
  const controlProps = isValidElement<{ id?: string }>(only) ? only.props : {}
  const id = controlProps.id ?? `field-${uid}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const control: ReactNode = cloneElement(only as ReactElement<Record<string, unknown>>, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    required: required || undefined,
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
