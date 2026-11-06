import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from './cn'

export interface BreadcrumbItem {
  label: string
  /** Sem `to`, o item é texto; o último é sempre a página atual. */
  to?: string
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Você está em" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-corpo text-tinta-suave">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-borda-campo" />}
              {last || !item.to ? (
                <span aria-current={last ? 'page' : undefined} className={cn('truncate', last && 'font-semibold text-tinta')}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="truncate rounded-sm hover:text-azul hover:underline underline-offset-2">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
