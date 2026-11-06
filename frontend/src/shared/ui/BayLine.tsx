import { cn } from './cn'

export interface BayLineProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

/** Linha de baia pintada no piso: tracejado ambar, decorativa. */
export function BayLine({ orientation = 'horizontal', className }: BayLineProps) {
  const horizontal = orientation === 'horizontal'
  return (
    <div
      aria-hidden="true"
      data-orientation={orientation}
      className={cn(
        horizontal
          ? 'h-1 w-full bg-[repeating-linear-gradient(90deg,var(--color-oleo)_0_14px,transparent_14px_24px)]'
          : 'h-full w-1 bg-[repeating-linear-gradient(180deg,var(--color-oleo)_0_14px,transparent_14px_24px)]',
        className,
      )}
    />
  )
}
