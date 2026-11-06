import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from './cn'

export interface EmptyStateProps {
  title: string
  description?: string
  /** Normalmente um <Button>. */
  action?: ReactNode
  /** Ícone lucide; padrão: caixa de entrada. */
  icon?: ReactNode
  /** Sem moldura própria, para usar dentro de Card/Table. */
  bare?: boolean
  className?: string
}

export function EmptyState({ title, description, action, icon, bare = false, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 py-12 text-center',
        !bare && 'rounded-card border border-linha bg-superficie shadow-card',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-2 inline-flex size-14 items-center justify-center rounded-full bg-info-fundo text-azul [&_svg]:size-6"
      >
        {icon ?? <Inbox strokeWidth={1.75} />}
      </span>
      <h3 className="text-card font-semibold text-tinta">{title}</h3>
      {description && <p className="max-w-[46ch] text-corpo text-tinta-suave">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
