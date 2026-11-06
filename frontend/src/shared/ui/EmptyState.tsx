import type { ReactNode } from 'react'
import { BayLine } from './BayLine'

export interface EmptyStateProps {
  title: string
  description?: string
  /** Normalmente um <Button>. */
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-placa border border-risco bg-bancada p-6">
      <BayLine orientation="horizontal" className="w-16" />
      <h3 className="font-display text-secao font-semibold text-chassi">{title}</h3>
      {description && <p className="max-w-[60ch] text-corpo text-chassi-suave">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
