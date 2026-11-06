import { CarFront, ChevronRight, Disc3, Droplet, Gauge, LifeBuoy, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle, Plate, SampleDataTag } from '../../shared/ui'
import { formatBrlCents, formatInt } from './format'
import type { HistoryEntry, HistoryKind, VehicleSample } from './types'

const kindIcon: Record<HistoryKind, LucideIcon> = {
  freio: Disc3,
  oleo: Droplet,
  pneu: LifeBuoy,
}

export interface VehicleTimelineProps {
  vehicle: VehicleSample
  history: HistoryEntry[]
}

/** Composição do portal do cliente: cartão do veículo com alerta de próximo serviço e histórico em linha do tempo. */
export function VehicleTimeline({ vehicle, history }: VehicleTimelineProps) {
  return (
    <Card as="section" aria-labelledby="veiculo-titulo" className="@container">
      <CardHeader actions={<SampleDataTag />}>
        <CardTitle id="veiculo-titulo">Veículo e histórico de serviços</CardTitle>
      </CardHeader>
      <CardBody className="pb-6">
        <div className="flex flex-col items-start gap-5 rounded-card border border-linha p-5 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-7">
          <span
            aria-hidden="true"
            className="inline-flex h-28 w-full shrink-0 items-center justify-center rounded-controle bg-gradient-to-br from-info-fundo to-coluna-cinza text-azul @min-[560px]:w-48"
          >
            <CarFront size={64} strokeWidth={1.25} />
          </span>
          <div className="flex min-w-0 flex-col items-start gap-3">
            <p className="text-secao font-semibold tracking-[-0.01em] text-tinta">{vehicle.model}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Plate value={vehicle.plate} size="md" />
              <p className="flex items-center gap-1.5 text-destaque text-tinta-suave">
                <Gauge aria-hidden="true" size={18} strokeWidth={1.75} />
                <span className="tabular-nums">{formatInt(vehicle.km)} km</span>
              </p>
            </div>
            <p className="flex items-center gap-2 rounded-controle bg-atencao-fundo px-3 py-2 text-mini font-medium text-atencao-texto">
              <TriangleAlert aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
              <span>Próximo serviço: {vehicle.nextService}</span>
            </p>
          </div>
        </div>

        <h4 className="mt-6 mb-3 text-card font-semibold text-tinta">Histórico de serviços</h4>
        <ol>
          {history.map((entry, index) => {
            const Icon = kindIcon[entry.kind]
            const last = index === history.length - 1
            return (
              <li key={entry.id} className="relative flex gap-4">
                {!last && (
                  <span aria-hidden="true" className="absolute top-12 -bottom-1 left-6 w-0.5 -translate-x-1/2 bg-linha" />
                )}
                <span
                  aria-hidden="true"
                  className="relative z-10 mt-3 inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-azul text-white ring-4 ring-superficie"
                >
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <div className={`flex min-w-0 flex-1 items-center justify-between gap-3 py-4 ${last ? '' : 'border-b border-linha'}`}>
                  <div className="min-w-0">
                    <p className="text-mini text-tinta-suave">{entry.date}</p>
                    <p className="text-destaque font-semibold text-tinta">{entry.title}</p>
                    <p className="text-mini text-tinta-suave">{entry.shop}</p>
                  </div>
                  <p className="flex shrink-0 items-center gap-2 text-card font-semibold text-tinta tabular-nums">
                    {formatBrlCents(entry.value)}
                    <ChevronRight aria-hidden="true" size={18} strokeWidth={1.75} className="text-tinta-suave" />
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </CardBody>
    </Card>
  )
}
