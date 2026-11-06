import { cn } from './cn'
import { isValidPlate, normalizePlate } from './plateFormat'

export interface PlateProps {
  value: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { body: 'text-destaque px-2 py-0.5', band: 'text-[8px] leading-3 px-2' },
  md: { body: 'text-secao px-3 py-1', band: 'text-[9px] leading-3 px-3' },
  lg: { body: 'text-titulo px-4 py-1.5', band: 'text-[11px] leading-4 px-4' },
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
          'inline-flex items-center rounded-placa border border-borda-campo bg-concreto font-display font-semibold tracking-wider text-chassi-suave',
          s.body,
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
        'inline-flex flex-col overflow-hidden rounded-placa border-2 border-chassi bg-white text-chassi',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'bg-esmalte text-center font-sans font-semibold tracking-[0.2em] text-white',
          s.band,
        )}
      >
        BRASIL
      </span>
      <span
        aria-hidden="true"
        className={cn('text-center font-display font-bold tracking-wider', s.body)}
      >
        {text}
      </span>
    </span>
  )
}
