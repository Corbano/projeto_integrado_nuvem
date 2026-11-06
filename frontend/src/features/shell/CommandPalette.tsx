import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, icon, Input } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { useAuth } from '../auth/useAuth'
import { HOME_ENTRY, MODULES } from './modules'

interface PaletteEntry {
  id: string
  title: string
  description: string
  route: string
  icon: (typeof HOME_ENTRY)['icon']
  available: boolean
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  /** Texto já digitado na busca do topo (ao abrir por tecla). */
  initialQuery?: string
}

export function CommandPalette({ open, onClose, initialQuery = '' }: CommandPaletteProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Ir para">
      <PaletteBody initialQuery={initialQuery} onClose={onClose} />
    </Dialog>
  )
}

function PaletteBody({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)
  const [activeId, setActiveId] = useState<string | null>(null)

  const results = useMemo<PaletteEntry[]>(() => {
    const entries: PaletteEntry[] = [HOME_ENTRY, ...MODULES.filter((m) => can(...m.roles))]
    const needle = normalize(query.trim())
    return needle ? entries.filter((e) => normalize(`${e.title} ${e.description}`).includes(needle)) : entries
  }, [can, query])

  const enabled = results.filter((e) => e.available)
  const active = enabled.find((e) => e.id === activeId) ?? enabled[0] ?? null
  const optionId = (id: string) => `paleta-opcao-${id}`

  useEffect(() => {
    if (active) document.getElementById(optionId(active.id))?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  function go(entry: PaletteEntry) {
    if (!entry.available) return
    onClose()
    navigate(entry.route)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (enabled.length === 0) return
      const index = active ? enabled.indexOf(active) : -1
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveId(enabled[(index + step + enabled.length) % enabled.length].id)
    } else if (event.key === 'Home' || event.key === 'End') {
      if (enabled.length === 0) return
      event.preventDefault()
      setActiveId(enabled[event.key === 'Home' ? 0 : enabled.length - 1].id)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (active) go(active)
    }
  }

  return (
    <div>
      <Input
        data-autofocus
        role="combobox"
        aria-label="Buscar funcionalidade"
        aria-expanded="true"
        aria-controls="paleta-lista"
        aria-autocomplete="list"
        aria-activedescendant={active ? optionId(active.id) : undefined}
        autoComplete="off"
        placeholder="Buscar funcionalidade…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveId(null)
        }}
        onKeyDown={onKeyDown}
        leadingIcon={<Search strokeWidth={1.75} />}
      />
      <ul
        id="paleta-lista"
        role="listbox"
        aria-label="Funcionalidades"
        className="mt-3 -mx-2 max-h-[min(22rem,50vh)] overflow-y-auto px-2 py-0.5"
      >
        {results.map((entry) => {
          const Icon = entry.icon
          const isActive = active?.id === entry.id
          return (
            <li
              key={entry.id}
              id={optionId(entry.id)}
              role="option"
              aria-selected={isActive}
              aria-disabled={!entry.available || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => entry.available && setActiveId(entry.id)}
              onClick={() => go(entry)}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-controle px-3 py-2 text-tinta',
                entry.available ? 'cursor-pointer' : 'cursor-not-allowed text-tinta-suave',
                isActive && 'bg-info-fundo',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
                  isActive ? 'bg-azul text-white' : 'bg-fundo text-tinta-suave',
                )}
              >
                <Icon {...icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-corpo font-semibold">{entry.title}</span>
                <span className="block truncate text-legenda text-tinta-suave">{entry.description}</span>
              </span>
              {entry.available ? (
                isActive && <CornerDownLeft aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0 text-azul" />
              ) : (
                <span className="shrink-0 rounded-pilula bg-atencao-fundo px-2 py-0.5 text-legenda font-semibold text-atencao-texto">
                  Em breve
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {results.length === 0 && (
        <p role="status" className="py-8 text-center text-corpo text-tinta-suave">
          Nada encontrado para “{query.trim()}”. Tente outro termo.
        </p>
      )}
      <p aria-hidden="true" className="mt-3 hidden border-t border-linha pt-3 text-legenda text-tinta-suave sm:block">
        ↑ ↓ para navegar · Enter para abrir · Esc para fechar
      </p>
    </div>
  )
}
