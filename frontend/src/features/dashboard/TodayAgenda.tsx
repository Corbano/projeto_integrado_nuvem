import { Card, CardBody, CardHeader, CardTitle, Plate, SampleDataTag } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import type { AgendaDay, AppointmentItem } from './types'

export interface TodayAgendaProps {
  days: AgendaDay[]
  items: AppointmentItem[]
}

export function TodayAgenda({ days, items }: TodayAgendaProps) {
  return (
    <Card as="section" aria-labelledby="agenda-titulo">
      <CardHeader actions={<SampleDataTag />}>
        <CardTitle id="agenda-titulo">Agenda de hoje</CardTitle>
        <p className="mt-1 text-corpo text-tinta-suave">
          <span className="font-semibold text-tinta tabular-nums">{items.length}</span> agendamentos
        </p>
      </CardHeader>
      <CardBody className="pb-6">
        <ol aria-label="Dias da semana" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {days.map((day) => (
            <li
              key={day.id}
              aria-current={day.today ? 'date' : undefined}
              className={cn(
                'flex min-w-9 flex-1 flex-col items-center rounded-controle py-2 text-center',
                day.today ? 'bg-azul text-white shadow-card' : 'text-tinta-suave',
              )}
            >
              <span className="text-legenda font-medium">{day.weekday}</span>
              <span className="text-card font-semibold tabular-nums">{day.day}</span>
              {day.today && <span className="sr-only">(hoje)</span>}
            </li>
          ))}
        </ol>

        <ul className="mt-5 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-stretch gap-3">
              <span className="w-12 shrink-0 pt-3 text-mini font-semibold text-tinta tabular-nums">{item.time}</span>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-controle border-l-[3px] border-azul bg-fundo px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-corpo font-semibold text-tinta">{item.client}</p>
                  <p className="truncate text-legenda text-tinta-suave">
                    {item.vehicle} · {item.service}
                  </p>
                </div>
                <Plate value={item.plate} size="sm" className="shrink-0" />
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
