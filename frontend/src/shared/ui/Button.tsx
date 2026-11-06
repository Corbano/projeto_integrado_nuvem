import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'accent' | 'dark' | 'outline' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const outline =
  'bg-superficie text-tinta border border-linha shadow-controle hover:border-borda-campo hover:bg-fundo'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-azul text-white border border-azul hover:bg-azul-escuro hover:border-azul-escuro',
  accent: 'bg-menta text-navy border border-menta hover:bg-menta-escuro hover:border-menta-escuro',
  dark: 'bg-navy text-white border border-navy hover:bg-navy-2 hover:border-navy-2',
  outline,
  /** Alias de `outline`, mantido por compatibilidade. */
  secondary: outline,
  danger: 'bg-critico-texto text-white border border-critico-texto hover:bg-critico-escuro hover:border-critico-escuro',
  ghost: 'bg-transparent text-azul border border-transparent hover:bg-info-fundo',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-mini gap-1.5 [&_svg]:size-4',
  md: 'min-h-11 px-4 text-corpo gap-2 [&_svg]:size-[18px]',
  lg: 'min-h-12 px-5 text-destaque gap-2 [&_svg]:size-5',
}

export function Button({
  variant = 'primary',
  size = 'md',
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
        'inline-flex items-center justify-center rounded-controle font-sans font-semibold whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,box-shadow] duration-150 [&_svg]:shrink-0',
        'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-progress aria-disabled:opacity-85',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {loading && <LoaderCircle aria-hidden="true" strokeWidth={2} className="animate-spin" />}
      {children}
      {loading && <span className="sr-only">Carregando</span>}
    </button>
  )
}
