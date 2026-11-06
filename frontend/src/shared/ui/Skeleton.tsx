import { cn } from './cn'

export interface SkeletonProps {
  className?: string
}

/** Bloco de carregamento. Decorativo: quem usa deve anunciar o estado (aria-busy na regiao). */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton"
      className={cn('animate-pulse rounded-campo bg-risco/70', 'h-4 w-full', className)}
    />
  )
}
