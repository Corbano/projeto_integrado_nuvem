import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from './cn'

export interface StatTrend {
  /** Variação em %, com sinal (ex.: 12.4 ou -3.6). */
  value: number
  /** Complemento visível, ex.: "vs. mês anterior". */
  label?: string
  /** Para métricas em que subir é ruim (despesas, estoque crítico). Padrão: true. */
  positiveIsGood?: boolean
}

export interface StatCardProps {
  label: string
  /** Valor já formatado (ex.: "R$ 25.721"). */
  value: ReactNode
  trend?: StatTrend
  icon?: ReactNode
  /** Conteúdo extra no canto (ex.: <SampleDataTag />). */
  extra?: ReactNode
  className?: string
}

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** Texto da tendência sem depender de cor: "Alta de 12,4%", "Queda de 3,6%", "Estável". */
function trendText(value: number): string {
  if (value === 0) return 'Estável'
  return `${value > 0 ? 'Alta' : 'Queda'} de ${percent.format(Math.abs(value))}%`
}

export function StatCard({ label, value, trend, icon, extra, className }: StatCardProps) {
  let trendNode: ReactNode = null
  if (trend) {
    const good = trend.positiveIsGood ?? true
    const tone =
      trend.value === 0
        ? 'bg-coluna-cinza text-tinta-suave'
        : (trend.value > 0) === good
          ? 'bg-ok-fundo text-ok-texto'
          : 'bg-critico-fundo text-critico-texto'
    const Arrow = trend.value > 0 ? ArrowUpRight : trend.value < 0 ? ArrowDownRight : ArrowRight
    trendNode = (
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-mini">
        <span
          data-trend={trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'flat'}
          className={cn('inline-flex items-center gap-1 rounded-pilula py-0.5 pr-2 pl-1.5 font-semibold', tone)}
        >
          <Arrow aria-hidden="true" size={14} strokeWidth={2.25} />
          <span className="sr-only">{trendText(trend.value)}</span>
          <span aria-hidden="true">
            {trend.value === 0 ? 'Estável' : `${trend.value > 0 ? '+' : '−'}${percent.format(Math.abs(trend.value))}%`}
          </span>
        </span>
        {trend.label && <span className="text-tinta-suave">{trend.label}</span>}
      </p>
    )
  }

  return (
    <section
      className={cn('rounded-card border border-linha bg-superficie p-5 shadow-card', className)}
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-controle bg-info-fundo text-azul [&_svg]:size-5"
            >
              {icon}
            </span>
          )}
          <h3 className="text-corpo font-medium text-tinta-suave">{label}</h3>
        </div>
        {extra}
      </div>
      <p className="mt-3 font-display text-kpi font-bold tracking-[0.01em] text-navy tabular-nums">{value}</p>
      {trendNode}
    </section>
  )
}
