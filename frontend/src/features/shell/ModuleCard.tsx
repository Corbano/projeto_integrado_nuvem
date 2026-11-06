import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, StatusPill, icon } from '../../shared/ui'
import type { AccentColor } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import type { AppModule } from './modules'

/** Tom escuro do acento (>= 4,5:1 sobre o fundo suave) para ícones e checks; a barra usa a cor pura. */
const INK: Record<AccentColor, string> = {
  azul: 'var(--color-azul)',
  menta: 'var(--color-menta-texto)',
  violeta: 'var(--color-violeta-texto)',
  ciano: 'var(--color-ciano-texto)',
}

const PURE: Record<AccentColor, string> = {
  azul: 'var(--color-acento-azul)',
  menta: 'var(--color-acento-menta)',
  violeta: 'var(--color-acento-violeta)',
  ciano: 'var(--color-acento-ciano)',
}

const buttonBase =
  'inline-flex min-h-11 min-w-[9rem] flex-1 items-center justify-center gap-2 rounded-controle border px-4 text-corpo font-semibold'

export function ModuleCard({ module }: { module: AppModule }) {
  const Icon = module.icon
  const style = {
    '--ink': INK[module.accent],
    '--tint': `color-mix(in srgb, ${PURE[module.accent]} 12%, white)`,
  } as CSSProperties

  return (
    <Card
      as="article"
      accent={module.accent}
      interactive={module.available}
      style={style}
      data-module={module.id}
      className={cn('h-full w-full', !module.available && 'bg-superficie/70')}
    >
      {module.available && (
        <span
          aria-hidden="true"
          data-testid="modulo-concluido-barra"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-card"
        >
          <span className="absolute inset-x-0 bottom-0 h-1 bg-azul" />
        </span>
      )}
      <CardHeader className="pt-5">
        <span
          aria-hidden="true"
          className="mb-4 inline-flex size-12 items-center justify-center rounded-[14px] bg-[var(--tint)] text-[var(--ink)]"
        >
          <Icon size={24} strokeWidth={1.75} />
        </span>
        <CardTitle as="h3" className={cn('text-[19px]', !module.available && 'text-tinta-suave')}>
          {module.title}
        </CardTitle>
        <CardDescription className="mt-1.5 text-destaque">{module.description}</CardDescription>
      </CardHeader>
      <CardBody className="pt-6 pb-7">
        <ul className={cn('space-y-3.5', !module.available && 'opacity-75')}>
          {module.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3 text-corpo text-tinta-suave">
              <Check {...icon} size={18} strokeWidth={2.25} className="mt-px shrink-0 text-[var(--ink)]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </CardBody>
      <CardFooter className="flex flex-wrap items-center gap-3 pt-0">
        {module.available && (
          <StatusPill variant="info" dot={false} className="gap-1">
            <Check {...icon} size={14} strokeWidth={2.5} />
            Concluído
          </StatusPill>
        )}
        {module.available ? (
          <Link
            to={module.route}
            className={cn(
              buttonBase,
              'border-azul bg-azul text-white transition-colors hover:border-azul-escuro hover:bg-azul-escuro',
            )}
          >
            Abrir {module.title}
          </Link>
        ) : (
          <button
            type="button"
            aria-disabled="true"
            tabIndex={-1}
            onClick={(event) => event.preventDefault()}
            className={cn(buttonBase, 'cursor-not-allowed border-linha bg-coluna-cinza text-tinta-suave')}
          >
            Em breve
          </button>
        )}
      </CardFooter>
    </Card>
  )
}
