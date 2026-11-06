import { Avatar, Card, CardBody, CardHeader, CardTitle, SampleDataTag, StatusPill } from '../../shared/ui'
import type { StatusTone } from '../../shared/ui'
import type { MechanicItem, MechanicStatus } from './types'

const tone: Record<MechanicStatus, StatusTone> = {
  'Em serviço': 'info',
  Intervalo: 'attention',
  Disponível: 'ok',
}

const sinceLabel: Record<MechanicStatus, string> = {
  'Em serviço': 'Entrada',
  Intervalo: 'Pausa',
  Disponível: 'Entrada',
}

export interface ActiveMechanicsProps {
  items: MechanicItem[]
}

export function ActiveMechanics({ items }: ActiveMechanicsProps) {
  return (
    <Card as="section" aria-labelledby="mecanicos-titulo">
      <CardHeader actions={<SampleDataTag />}>
        <CardTitle id="mecanicos-titulo">Mecânicos ativos</CardTitle>
        <p className="mt-1 text-corpo text-tinta-suave">
          <span className="font-semibold text-tinta tabular-nums">{items.length}</span> na oficina hoje
        </p>
      </CardHeader>
      <CardBody className="pb-6">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-controle border border-linha px-3.5 py-3">
              <Avatar name={item.name} size="lg" decorative />
              <div className="min-w-0 flex-1">
                <p className="truncate text-corpo font-semibold text-tinta">{item.name}</p>
                <p className="truncate text-legenda text-tinta-suave">{item.specialty}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusPill variant={tone[item.status]}>{item.status}</StatusPill>
                <span className="text-legenda text-tinta-suave">
                  {sinceLabel[item.status]} <span className="font-semibold text-ok-texto tabular-nums">{item.since}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
