import { cn } from './cn'

export type ProgressTone = 'azul' | 'menta' | 'ok' | 'atencao' | 'critico' | 'violeta' | 'laranja'

const fill: Record<ProgressTone, string> = {
  azul: 'var(--color-azul)',
  menta: 'var(--color-menta)',
  ok: 'var(--color-ok)',
  atencao: 'var(--color-atencao)',
  critico: 'var(--color-critico)',
  violeta: 'var(--color-acento-violeta)',
  laranja: 'var(--color-acento-laranja)',
}

function clampPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, (value / max) * 100)))
}

export interface ProgressBarProps {
  value: number
  max?: number
  /** Nome da medida, para leitores de tela (e visível com showLabel). */
  label: string
  tone?: ProgressTone
  showLabel?: boolean
  showValue?: boolean
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'azul',
  showLabel = false,
  showValue = false,
  className,
}: ProgressBarProps) {
  const pct = clampPercent(value, max)
  return (
    <div className={className}>
      {(showLabel || showValue) && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-mini">
          {showLabel && <span className="font-medium text-tinta">{label}</span>}
          {showValue && <span className="ml-auto font-semibold text-tinta-suave tabular-nums">{pct}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}%`}
        className="h-2 w-full overflow-hidden rounded-pilula bg-linha"
      >
        <div
          className="h-full rounded-pilula transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: fill[tone] }}
        />
      </div>
    </div>
  )
}

export interface DonutProgressProps {
  value: number
  max?: number
  label: string
  tone?: ProgressTone
  /** Diâmetro em px (padrão 56). */
  size?: number
  className?: string
}

/** Anel de progresso em SVG com o percentual no centro. Exposto como imagem com rótulo. */
export function DonutProgress({ value, max = 100, label, tone = 'azul', size = 56, className }: DonutProgressProps) {
  const pct = clampPercent(value, max)
  const stroke = Math.max(4, Math.round(size / 9))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  return (
    <span
      role="img"
      aria-label={`${label}: ${pct}%`}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-linha)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fill[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span aria-hidden="true" className="absolute text-mini font-bold text-tinta tabular-nums">
        {pct}%
      </span>
    </span>
  )
}
