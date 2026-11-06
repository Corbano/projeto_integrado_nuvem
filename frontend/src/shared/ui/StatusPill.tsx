import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type StatusTone = 'ok' | 'attention' | 'critical' | 'neutral' | 'info'

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusTone
  /** Ponto colorido antes do texto (padrão: true). O texto sempre carrega o significado. */
  dot?: boolean
}

const tones: Record<StatusTone, { pill: string; dot: string }> = {
  ok: { pill: 'bg-ok-fundo text-ok-texto', dot: 'bg-ok' },
  attention: { pill: 'bg-atencao-fundo text-atencao-texto', dot: 'bg-atencao' },
  critical: { pill: 'bg-critico-fundo text-critico-texto', dot: 'bg-critico' },
  neutral: { pill: 'bg-coluna-cinza text-tinta-suave', dot: 'bg-borda-campo' },
  info: { pill: 'bg-info-fundo text-azul', dot: 'bg-azul' },
}

/** Pílula de status: fundo suave, texto escuro do mesmo tom e ponto colorido. */
export function StatusPill({ variant = 'neutral', dot = true, className, children, ...rest }: StatusPillProps) {
  const tone = tones[variant]
  return (
    <span
      {...rest}
      data-variant={variant}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pilula px-2.5 py-0.5 text-legenda font-semibold whitespace-nowrap',
        tone.pill,
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} />}
      {children}
    </span>
  )
}

/** Nome antigo, mantido como alias. */
export const Badge = StatusPill
export type BadgeProps = StatusPillProps
export type BadgeVariant = StatusTone
