import { cn } from './cn'

export interface LogoProps {
  className?: string
}

/** Marca: simbolo (chave de boca sobre linha de baia) + nome em Barlow Condensed. Cor herdada via currentColor. */
export function Logo({ className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0" fill="none">
        <rect x="1.5" y="1.5" width="29" height="29" rx="6" stroke="currentColor" strokeWidth="2" />
        <path d="M9 22 16 9l7 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 26h20" stroke="var(--color-oleo)" strokeWidth="2.5" strokeDasharray="4 3" />
      </svg>
      <span className="font-display text-secao leading-none font-bold tracking-wide">Auto Center</span>
    </span>
  )
}
