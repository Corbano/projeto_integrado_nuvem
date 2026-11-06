import { cn } from './cn'
import { GEAR_PATH } from './logoMark'

export interface LogoProps {
  className?: string
  /** onLight: placa navy sobre fundo claro; onDark: placa translúcida sobre navy. */
  tone?: 'onLight' | 'onDark'
  size?: 'sm' | 'md' | 'lg'
  /** Só o símbolo (ex.: barra lateral recolhida). O nome continua disponível para leitores de tela. */
  markOnly?: boolean
}


const sizes = {
  sm: { tile: 'size-8 rounded-[9px]', glyph: 'size-[22px]', word: 'text-[17px]' },
  md: { tile: 'size-10 rounded-controle', glyph: 'size-7', word: 'text-[19px]' },
  lg: { tile: 'size-12 rounded-xl', glyph: 'size-8', word: 'text-[22px]' },
}

/** Marca "Auto Center": engrenagem azul com cubo menta numa placa navy + nome em Inter 700 (cor herdada). */
export function Logo({ className, tone = 'onLight', size = 'md', markOnly = false }: LogoProps) {
  const s = sizes[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center',
          s.tile,
          tone === 'onLight' ? 'bg-navy' : 'bg-white/[0.07] ring-1 ring-white/15 ring-inset',
        )}
      >
        <svg viewBox="0 0 24 24" className={s.glyph}>
          <path d={GEAR_PATH} fill="var(--color-azul)" />
          <circle cx="12" cy="12" r="4.1" fill={tone === 'onLight' ? 'var(--color-navy)' : '#1a2356'} />
          <circle cx="12" cy="12" r="1.9" fill="var(--color-menta)" />
        </svg>
      </span>
      {markOnly ? (
        <span className="sr-only">Auto Center</span>
      ) : (
        <span className={cn('leading-none font-bold tracking-[-0.02em] whitespace-nowrap', s.word)}>Auto Center</span>
      )}
    </span>
  )
}
