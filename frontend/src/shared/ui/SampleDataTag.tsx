import { FlaskConical } from 'lucide-react'
import { cn } from './cn'

/** Etiqueta visível em cards alimentados por dados fictícios (demo-data.ts). */
export function SampleDataTag({ className }: { className?: string }) {
  return (
    <span
      title="Números fictícios, só para demonstração."
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-pilula border border-dashed border-borda-campo bg-fundo px-2 py-0.5 text-legenda font-semibold whitespace-nowrap text-tinta-suave',
        className,
      )}
    >
      <FlaskConical aria-hidden="true" size={13} strokeWidth={2} />
      Dados de exemplo
    </span>
  )
}
