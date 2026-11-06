import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type BadgeVariant = 'ok' | 'attention' | 'critical' | 'neutral' | 'info'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  ok: 'bg-sinal/12 text-sinal-texto border-sinal/40',
  attention: 'bg-oleo/25 text-chassi border-oleo',
  critical: 'bg-freio/12 text-freio-texto border-freio/40',
  neutral: 'bg-risco/50 text-chassi-suave border-risco',
  info: 'bg-esmalte/12 text-esmalte border-esmalte/40',
}

export function Badge({ variant = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      data-variant={variant}
      className={cn(
        'inline-flex items-center rounded-campo border px-2 py-0.5 text-mini font-semibold whitespace-nowrap',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
