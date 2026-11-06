import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type AccentColor = 'azul' | 'menta' | 'violeta' | 'ciano'

const accentBar: Record<AccentColor, string> = {
  azul: 'bg-acento-azul',
  menta: 'bg-acento-menta',
  violeta: 'bg-acento-violeta',
  ciano: 'bg-acento-ciano',
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Barra curta de cor no topo, que identifica a funcionalidade. */
  accent?: AccentColor
  /** Sobe 2 px e reforça a sombra no hover (cards clicáveis). */
  interactive?: boolean
  as?: ElementType
}

/** Superfície branca, raio 16, borda e sombra suaves. Compor com CardHeader/CardBody/CardFooter. */
export function Card({ accent, interactive = false, as: Tag = 'div', className, children, ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      data-accent={accent}
      className={cn(
        'relative flex flex-col rounded-card border border-linha bg-superficie text-tinta shadow-card',
        interactive &&
          'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-within:shadow-card-hover',
        className,
      )}
    >
      {accent && (
        <span
          aria-hidden="true"
          className={cn('mx-6 mt-6 block h-1.5 w-12 shrink-0 rounded-pilula sm:mx-7', accentBar[accent])}
        />
      )}
      {children}
    </Tag>
  )
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Ações à direita do título (botão, etiqueta). */
  actions?: ReactNode
}

export function CardHeader({ actions, className, children, ...rest }: CardHeaderProps) {
  return (
    <div
      {...rest}
      className={cn(
        'flex items-start justify-between gap-4 px-6 pt-6 sm:px-7 [[data-accent]>&]:pt-5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}

export function CardTitle({ as: Tag = 'h3', className, ...rest }: CardTitleProps) {
  return <Tag {...rest} className={cn('text-card font-semibold tracking-[-0.01em] text-tinta', className)} />
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...rest} className={cn('mt-1 text-corpo text-tinta-suave', className)} />
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('flex-1 px-6 py-5 sm:px-7', className)} />
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn('flex flex-wrap items-center gap-3 px-6 pt-1 pb-6 sm:px-7', className)} />
  )
}
