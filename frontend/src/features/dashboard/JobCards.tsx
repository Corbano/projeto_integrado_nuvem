import { Clock } from 'lucide-react'
import { Avatar, Card, CardBody, CardHeader, CardTitle, Plate, ProgressBar, SampleDataTag } from '../../shared/ui'
import type { ProgressTone } from '../../shared/ui'
import type { JobItem, JobStatus } from './types'

/** Cor do ponto, do rótulo e da barra em cada estado (rótulos claros sobre o cartão escuro). */
const look: Record<JobStatus, { dot: string; text: string; bar: ProgressTone }> = {
  'Em andamento': { dot: 'bg-[#6f9bff]', text: 'text-[#9db9ff]', bar: 'azul' },
  'Aguardando peça': { dot: 'bg-[#ffc24d]', text: 'text-[#ffd27a]', bar: 'atencao' },
  'Em revisão': { dot: 'bg-[#b496ff]', text: 'text-[#cdbbff]', bar: 'violeta' },
  'Pronto para entrega': { dot: 'bg-[#4fe3c1]', text: 'text-[#86efd6]', bar: 'menta' },
}

const order: JobStatus[] = ['Em andamento', 'Aguardando peça', 'Em revisão', 'Pronto para entrega']

export interface JobCardsProps {
  items: JobItem[]
}

export function JobCards({ items }: JobCardsProps) {
  return (
    <Card as="section" aria-labelledby="servicos-titulo" className="@container">
      <CardHeader actions={<SampleDataTag />}>
        <CardTitle id="servicos-titulo">Serviços em andamento</CardTitle>
        <p className="mt-1 text-corpo text-tinta-suave">
          <span className="font-semibold text-tinta tabular-nums">{items.length}</span> ordens abertas agora
        </p>
      </CardHeader>
      <CardBody>
        <ul
          aria-label="Resumo por situação"
          className="mb-5 grid grid-cols-2 divide-x divide-linha overflow-hidden rounded-controle bg-fundo @min-[560px]:grid-cols-4"
        >
          {order.map((status) => (
            <li key={status} className="px-4 py-2.5 text-mini text-tinta-suave">
              <span className="block truncate">{status}</span>
              <span className="text-card font-semibold text-tinta tabular-nums">
                {items.filter((item) => item.status === status).length}
              </span>
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
          {items.map((item) => {
            const tone = look[item.status]
            return (
              <li key={item.id} className="flex flex-col gap-3.5 rounded-[14px] bg-navy-2 p-4 text-white shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex items-center gap-2 text-mini font-semibold ${tone.text}`}>
                    <span aria-hidden="true" className={`size-2 rounded-full ${tone.dot}`} />
                    {item.status}
                  </span>
                  <Plate value={item.plate} size="sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-destaque leading-snug font-semibold">{item.service}</p>
                  <p className="mt-0.5 text-mini text-white/70">{item.vehicle}</p>
                </div>
                <ProgressBar
                  value={item.progress}
                  label={`Progresso de ${item.service}`}
                  tone={tone.bar}
                  className="[&_[role=progressbar]]:bg-white/20 [&_span]:text-white/80"
                  showValue
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-mini text-white/90">
                    <Avatar name={item.mechanic} size="sm" decorative />
                    <span className="truncate">{item.mechanic}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-mini text-white/70">
                    <Clock aria-hidden="true" size={14} strokeWidth={1.75} />
                    <span className="sr-only">Prazo:</span>
                    {item.due}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}
