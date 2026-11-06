import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-esmalte text-bancada border border-esmalte hover:bg-chassi hover:border-chassi',
  secondary: 'bg-bancada text-chassi border border-borda-campo hover:border-chassi',
  danger: 'bg-freio-texto text-bancada border border-freio-texto hover:bg-chassi hover:border-chassi',
  ghost: 'bg-transparent text-esmalte border border-transparent hover:bg-risco/50',
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <circle cx="12" cy="12" r="9" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  onClick,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-campo px-4 font-sans text-corpo font-semibold',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-progress aria-disabled:opacity-80',
        variants[variant],
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
      {loading && <span className="sr-only">Carregando</span>}
    </button>
  )
}
