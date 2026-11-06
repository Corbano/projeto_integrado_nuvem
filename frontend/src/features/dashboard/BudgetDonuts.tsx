import { Card, DonutProgress, SampleDataTag } from '../../shared/ui'
import type { ProgressTone } from '../../shared/ui'
import { formatBrl } from './format'
import type { BudgetItem } from './types'

const tones: ProgressTone[] = ['laranja', 'azul', 'violeta']

export interface BudgetDonutsProps {
  items: BudgetItem[]
}

/** Mini-cards em fileira (como na referência): anel de % do orçamento do mês + valor usado. */
export function BudgetDonuts({ items }: BudgetDonutsProps) {
  return (
    <ul className="@container grid grid-cols-1 gap-5 @min-[520px]:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.id} className="flex">
          <Card as="section" aria-label={`${item.label}, orçamento do mês`} className="w-full">
            <div className="flex items-center gap-4 px-5 pt-5 pb-4">
              <DonutProgress
                value={item.used}
                max={item.budget}
                label={`${item.label}, orçamento usado`}
                tone={tones[index % tones.length]}
                size={64}
              />
              <div className="min-w-0">
                <h3 className="text-corpo font-medium text-tinta-suave">{item.label}</h3>
                <p className="text-card font-semibold text-tinta tabular-nums">{formatBrl(item.used)}</p>
                <p className="text-legenda text-tinta-suave tabular-nums">de {formatBrl(item.budget)}</p>
              </div>
            </div>
            <div className="mt-auto border-t border-linha px-5 py-2">
              <SampleDataTag />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}
