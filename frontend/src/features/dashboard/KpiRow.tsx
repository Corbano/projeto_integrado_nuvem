import type { ReactNode } from 'react'
import { CarFront, ClipboardList, PackageX, Wallet } from 'lucide-react'
import { SampleDataTag, StatCard } from '../../shared/ui'
import type { KpiItem } from './types'

const icons: Record<KpiItem['id'], ReactNode> = {
  faturamento: <Wallet strokeWidth={1.75} />,
  ordens: <ClipboardList strokeWidth={1.75} />,
  veiculos: <CarFront strokeWidth={1.75} />,
  estoque: <PackageX strokeWidth={1.75} />,
}

export interface KpiRowProps {
  items: KpiItem[]
}

/** Quatro indicadores no topo da visão geral. Cada um leva a etiqueta de dados de exemplo no rodapé. */
export function KpiRow({ items }: KpiRowProps) {
  return (
    <ul className="@container grid grid-cols-1 gap-5 @min-[520px]:grid-cols-2 @min-[1000px]:grid-cols-4">
      {items.map((item) => (
        <li
          key={item.id}
          data-testid={`kpi-${item.id}`}
          className="flex flex-col overflow-hidden rounded-card border border-linha bg-superficie shadow-card"
        >
          <StatCard
            className="flex-1 rounded-none! border-0! shadow-none!"
            label={item.label}
            value={item.value}
            trend={item.trend}
            icon={icons[item.id]}
          />
          <div className="border-t border-linha bg-fundo/70 px-5 py-2">
            <SampleDataTag />
          </div>
        </li>
      ))}
    </ul>
  )
}
