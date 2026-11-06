import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from './cn'

export interface TabItem {
  id: string
  label: string
  /** Contador opcional (ex.: pendências). */
  count?: number
  /** Conteúdo do painel; sem ele, o painel mostra `children` para a aba ativa. */
  content?: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onValueChange: (id: string) => void
  /** Rótulo da lista de abas para leitores de tela. */
  label: string
  children?: ReactNode
  className?: string
  panelClassName?: string
}

/**
 * Abas com sublinhado (WAI-ARIA tabs, ativação automática).
 * Tabindex móvel: só a aba ativa entra no Tab; ←/→ trocam, Home/End vão às pontas.
 */
export function Tabs({ items, value, onValueChange, label, children, className, panelClassName }: TabsProps) {
  const base = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === value),
  )
  const active = items[activeIndex]

  function move(index: number) {
    const target = items[(index + items.length) % items.length]
    onValueChange(target.id)
    refs.current[(index + items.length) % items.length]?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      Home: 0,
      End: items.length - 1,
    }
    if (event.key in keys) {
      event.preventDefault()
      move(keys[event.key])
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-linha"
      >
        {items.map((item, index) => {
          const selected = index === activeIndex
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[index] = el
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(item.id)}
              className={cn(
                'relative -mb-px inline-flex min-h-11 items-center gap-2 px-3.5 text-corpo font-semibold whitespace-nowrap transition-colors',
                'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors',
                'focus-visible:-outline-offset-2',
                selected
                  ? 'text-azul after:bg-azul'
                  : 'text-tinta-suave after:bg-transparent hover:text-tinta hover:after:bg-linha',
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-pilula px-1.5 text-legenda font-semibold tabular-nums',
                    selected ? 'bg-azul text-white' : 'bg-coluna-cinza text-tinta-suave',
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={active ? `${base}-tab-${active.id}` : undefined}
        tabIndex={0}
        className={cn('pt-5 focus-visible:outline-offset-4', panelClassName)}
      >
        {active?.content ?? children}
      </div>
    </div>
  )
}
