import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle, SampleDataTag, StatusPill } from '../../shared/ui'
import type { StatusTone } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import type { AlertLevel, MaintenanceAlertItem } from './types'

const levels: Record<AlertLevel, { text: string; tone: StatusTone; Icon: typeof OctagonAlert; badge: string }> = {
  critico: { text: 'Trocar agora', tone: 'critical', Icon: OctagonAlert, badge: 'bg-critico-fundo text-critico' },
  atencao: { text: 'Trocar em breve', tone: 'attention', Icon: TriangleAlert, badge: 'bg-atencao-fundo text-atencao' },
  ok: { text: 'Ok', tone: 'ok', Icon: CircleCheck, badge: 'bg-ok-fundo text-ok' },
}

export interface MaintenanceAlertsProps {
  items: MaintenanceAlertItem[]
}

/** Semáforo: o estado vai em ícone, texto e cor; nunca só em cor. */
export function MaintenanceAlerts({ items }: MaintenanceAlertsProps) {
  return (
    <Card as="section" aria-labelledby="alertas-titulo">
      <CardHeader actions={<SampleDataTag />}>
        <CardTitle id="alertas-titulo">Alertas de manutenção</CardTitle>
      </CardHeader>
      <CardBody className="pb-6">
        <ul className="flex flex-col divide-y divide-linha">
          {items.map((item) => {
            const level = levels[item.level]
            return (
              <li key={item.id} data-level={item.level} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  aria-hidden="true"
                  className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full', level.badge)}
                >
                  <level.Icon size={18} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <StatusPill variant={level.tone} className="mb-1">
                    {level.text}
                  </StatusPill>
                  <p className="text-corpo font-semibold text-tinta">{item.title}</p>
                  <p className="text-legenda text-tinta-suave">{item.detail}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}
