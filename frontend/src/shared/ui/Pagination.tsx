import { Button } from './Button'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const total = Math.max(1, totalPages)
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
      <Button
        variant="secondary"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </Button>
      <p className="text-corpo text-chassi-suave tabular-nums" aria-live="polite">
        Página {page} de {total}
      </p>
      <Button
        variant="secondary"
        aria-label="Próxima página"
        disabled={page >= total}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  )
}
