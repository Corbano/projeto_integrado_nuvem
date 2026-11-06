import { cn } from './cn'
import { isValidPlate, normalizePlate } from './plateFormat'

export interface PlateProps {
  value: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { body: 'text-[17px] leading-5 px-2 pt-px pb-0.5', band: 'text-[7px] leading-[10px] px-2' },
  md: { body: 'text-secao leading-7 px-3 pb-0.5', band: 'text-[8px] leading-3 px-3' },
  lg: { body: 'text-titulo leading-9 px-4 pb-1', band: 'text-[10px] leading-4 px-4' },
}

/**
 * Placa Mercosul. Entrada invalida nao lanca: mostra o texto cru numa placa neutra
 * e a validade fica exposta no aria-label e em data-valid.
 */
export function Plate({ value, size = 'md', className }: PlateProps) {
  const text = normalizePlate(value)
  const valid = isValidPlate(value)
  const s = sizes[size]

  if (!valid) {
    const shown = value.trim()
    return (
      <span
        role="img"
        aria-label={shown ? `Placa inválida: ${shown}` : 'Sem placa'}
        data-valid="false"
        className={cn(
          'inline-flex items-center rounded-placa border border-dashed border-borda-campo bg-fundo font-display font-bold tracking-wider text-tinta-suave',
          s.body,
          'py-0.5',
          className,
        )}
      >
        <span aria-hidden="true">{shown || 'Sem placa'}</span>
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label={`Placa ${text}`}
      data-valid="true"
      className={cn(
        'inline-flex flex-col overflow-hidden rounded-placa border-[1.5px] border-tinta bg-white text-tinta shadow-[0_1px_2px_rgba(16,25,74,0.08)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('bg-azul text-center font-sans font-semibold tracking-[0.24em] text-white', s.band)}
      >
        BRASIL
      </span>
      <span aria-hidden="true" className={cn('text-center font-display font-bold tracking-[0.06em]', s.body)}>
        {text}
      </span>
    </span>
  )
}
