import type { ReactNode } from 'react'
import { cn } from './cn'

export interface FilterBarProps {
  /** Busca e filtros, à esquerda (a busca cresce). */
  children: ReactNode
  /** Ações à direita (exportar, criar). */
  actions?: ReactNode
  /** Rótulo do grupo para leitores de tela, ex.: "Filtros de usuários". */
  label?: string
  className?: string
}

/** Barra acima de tabelas: busca + filtros à esquerda, ações à direita; quebra em telas estreitas. */
export function FilterBar({ children, actions, label, className }: FilterBarProps) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-3', className)}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 [&>:first-child]:min-w-56 [&>:first-child]:flex-1 sm:[&>:first-child]:max-w-md">
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}
