import type { ReactNode } from 'react'
import { Breadcrumb } from './Breadcrumb'
import type { BreadcrumbItem } from './Breadcrumb'
import { cn } from './cn'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Opcional: a barra superior do shell já mostra o caminho; use só em telas sem ela. */
  breadcrumb?: BreadcrumbItem[]
  /** Botões e etiquetas à direita do título. */
  actions?: ReactNode
  className?: string
}

/** Cabeçalho de página: título 28/700, subtítulo suave e ações à direita. */
export function PageHeader({ title, subtitle, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-2" />}
        <h1 className="text-titulo font-bold text-navy">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[62ch] text-destaque text-tinta-suave">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  )
}
