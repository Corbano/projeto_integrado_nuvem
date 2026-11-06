import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useResizeWidth } from './useResizeWidth'
import { Card, CardBody, CardHeader, CardTitle, SampleDataTag, Tabs } from '../../shared/ui'
import { formatBrl } from './format'
import type { RevenueSeries } from './types'

const HEIGHT = 250
const PAD = { left: 58, right: 14, top: 14, bottom: 30 }

const stroke: Record<RevenueSeries['id'], string> = {
  receita: 'var(--color-azul)',
  despesas: 'var(--color-acento-violeta)',
  lucro: 'var(--color-ok)',
}

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * magnitude >= raw) return factor * magnitude
  }
  return 10 * magnitude
}

function axisLabel(value: number): string {
  if (value === 0) return 'R$ 0'
  return value >= 1000 ? `R$ ${(value / 1000).toLocaleString('pt-BR')} mil` : `R$ ${value}`
}

/** Curva suave sem estourar os picos: tangentes horizontais nos pontos. */
function smoothPath(points: Array<[number, number]>): string {
  return points.reduce((path, [x, y], index) => {
    if (index === 0) return `M${x},${y}`
    const [px, py] = points[index - 1]
    const mid = (px + x) / 2
    return `${path} C${mid},${py} ${mid},${y} ${x},${y}`
  }, '')
}

export interface RevenueChartProps {
  series: RevenueSeries[]
}

export function RevenueChart({ series }: RevenueChartProps) {
  const [activeId, setActiveId] = useState<RevenueSeries['id']>(series[0]?.id ?? 'receita')
  const current = series.find((item) => item.id === activeId) ?? series[0]
  const gradientId = `grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <Card as="section" aria-labelledby="grafico-titulo">
      <CardHeader actions={<SampleDataTag />}>
        <CardTitle id="grafico-titulo">Receita dos últimos 30 dias</CardTitle>
      </CardHeader>
      <CardBody className="pt-2">
        <Tabs
          label="Série do gráfico"
          value={activeId}
          onValueChange={(id) => setActiveId(id as RevenueSeries['id'])}
          items={series.map((item) => ({ id: item.id, label: item.label }))}
        >
          {current && <ChartBody key={current.id} series={current} gradientId={gradientId} />}
        </Tabs>
      </CardBody>
    </Card>
  )
}

function ChartBody({ series, gradientId }: { series: RevenueSeries; gradientId: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const width = useResizeWidth(wrapperRef, 640)
  const [active, setActive] = useState<number | null>(null)

  const { points } = series
  const values = points.map((point) => point.value)
  const total = values.reduce((sum, value) => sum + value, 0)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const average = Math.round(total / values.length)
  const peak = points[values.indexOf(max)]
  const low = points[values.indexOf(min)]

  const step = niceStep(Math.max(max, 1) / 4)
  const top = step * 4
  const plotW = Math.max(width - PAD.left - PAD.right, 10)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotW)
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH
  const coords = points.map((point, index) => [x(index), y(point.value)] as [number, number])
  const line = smoothPath(coords)
  const area = `${line} L${x(points.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`
  const color = stroke[series.id]
  const xStep = width < 480 ? 7 : 5
  const xTicks = points.map((_, index) => index).filter((index) => index % xStep === 0 || index === points.length - 1)
  // Evita o último rótulo colado no penúltimo.
  const visibleTicks = xTicks.filter((index, position) => !(position === xTicks.length - 2 && points.length - 1 - index < xStep - 1))

  const summary =
    `${series.label} diária, de ${points[0].label} a ${points[points.length - 1].label}: ` +
    `total de ${formatBrl(total)}, média de ${formatBrl(average)} por dia, ` +
    `maior valor de ${formatBrl(max)} em ${peak.label} e menor de ${formatBrl(min)} em ${low.label}.`

  function indexFromPointer(event: PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left - PAD.left) / plotW
    return Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = points.length - 1
    const from = active ?? last + 1
    const next: Record<string, number> = {
      ArrowRight: Math.min(last, active === null ? 0 : from + 1),
      ArrowLeft: Math.max(0, active === null ? last : from - 1),
      Home: 0,
      End: last,
    }
    if (event.key === 'Escape') {
      setActive(null)
    } else if (event.key in next) {
      event.preventDefault()
      setActive(next[event.key])
    }
  }

  const activePoint = active === null ? null : points[active]
  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active), 64), width - 64)

  return (
    <div>
      <p className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-kpi font-bold tracking-[0.01em] text-navy tabular-nums">
          {formatBrl(total)}
        </span>
        <span className="text-mini text-tinta-suave">
          em 30 dias · média de <span className="font-semibold tabular-nums">{formatBrl(average)}</span> por dia
        </span>
      </p>

      <div
        ref={wrapperRef}
        tabIndex={0}
        role="group"
        aria-label={`Explorar ${series.label.toLowerCase()} por dia: use as setas para esquerda e direita`}
        className="relative rounded-controle touch-pan-y"
        onPointerMove={(event) => setActive(indexFromPointer(event))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <svg
          role="img"
          aria-label={summary}
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = tick * step
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--color-linha)"
                  strokeDasharray={tick === 0 ? undefined : '3 4'}
                />
                <text
                  x={PAD.left - 10}
                  y={y(value)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="var(--color-tinta-suave)"
                >
                  {axisLabel(value)}
                </text>
              </g>
            )
          })}
          {visibleTicks.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill="var(--color-tinta-suave)"
            >
              {points[index].label}
            </text>
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke={color} strokeOpacity="0.35" />
              <circle cx={x(active)} cy={y(points[active].value)} r="5" fill="var(--color-superficie)" stroke={color} strokeWidth="2.5" />
            </g>
          )}
        </svg>

        {activePoint && active !== null && (
          <div
            role="status"
            data-testid="chart-tooltip"
            style={{ left: tooltipLeft, top: Math.max(0, y(activePoint.value) - 66) }}
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-controle bg-navy px-3 py-2 text-center text-legenda whitespace-nowrap text-white shadow-menu"
          >
            <span className="block text-white/75">{activePoint.label}</span>
            <span className="block text-corpo font-semibold tabular-nums">{formatBrl(activePoint.value)}</span>
          </div>
        )}
      </div>

      <div className="sr-only">
      <table>
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">{series.label} (R$)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{formatBrl(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
