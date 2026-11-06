import { useId } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from './cn'
import { Select } from './Select'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Linhas por página: só aparece com onPageSizeChange. */
  pageSize?: number
  pageSizeOptions?: number[]
  onPageSizeChange?: (size: number) => void
  /** Texto à esquerda, ex.: "Mostrando 1–10 de 63 usuários". */
  summary?: ReactNode
  className?: string
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-controle border border-linha bg-superficie text-tinta',
        'shadow-controle transition-colors hover:border-borda-campo hover:bg-fundo',
        'disabled:cursor-not-allowed disabled:text-borda-campo disabled:shadow-none disabled:hover:border-linha disabled:hover:bg-superficie',
      )}
    >
      {children}
    </button>
  )
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
  summary,
  className,
}: PaginationProps) {
  const total = Math.max(1, totalPages)
  const sizeId = useId()
  const iconProps = { 'aria-hidden': true, size: 18, strokeWidth: 1.75 } as const
  return (
    <nav
      aria-label="Paginação"
      className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-corpo', className)}
    >
      <div className="min-w-0 text-tinta-suave">{summary}</div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2.5">
            <label htmlFor={sizeId} className="font-medium whitespace-nowrap text-tinta">
              Linhas por página
            </label>
            <Select
              id={sizeId}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              wrapperClassName="w-[76px]"
              className="min-h-9 pr-8 pl-3"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        )}
        <p className="font-medium whitespace-nowrap text-tinta tabular-nums" aria-live="polite">
          Página {page} de {total}
        </p>
        <div className="flex items-center gap-1.5">
          <PageButton label="Primeira página" disabled={page <= 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft {...iconProps} />
          </PageButton>
          <PageButton label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft {...iconProps} />
          </PageButton>
          <PageButton label="Próxima página" disabled={page >= total} onClick={() => onPageChange(page + 1)}>
            <ChevronRight {...iconProps} />
          </PageButton>
          <PageButton label="Última página" disabled={page >= total} onClick={() => onPageChange(total)}>
            <ChevronsRight {...iconProps} />
          </PageButton>
        </div>
      </div>
    </nav>
  )
}
