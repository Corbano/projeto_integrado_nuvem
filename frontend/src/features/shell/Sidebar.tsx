import { LogOut, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { Ref } from 'react'
import { Avatar, icon, Logo } from '../../shared/ui'
import { cn } from '../../shared/ui/cn'
import { useAuth } from '../auth/useAuth'
import { HOME_ENTRY, MODULES, NAV_GROUPS } from './modules'
import type { AppModule } from './modules'
import { ROLE_LABELS } from './roleLabels'

interface NavEntryData {
  id: string
  title: string
  route: string
  icon: AppModule['icon']
  available: boolean
}

const itemBase =
  'group/item flex min-h-11 items-center gap-3 rounded-controle px-3 py-1.5 text-corpo leading-tight font-medium transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

function NavEntry({ entry, iconOnly, onNavigate }: { entry: NavEntryData; iconOnly: boolean; onNavigate: () => void }) {
  const Icon = entry.icon
  const justify = iconOnly ? 'justify-center px-0' : ''
  if (!entry.available) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title={`${entry.title} (em breve)`}
        className={cn(itemBase, 'cursor-not-allowed text-white/50', justify)}
      >
        <Icon {...icon} className="shrink-0" />
        <span className={cn('min-w-0 flex-1', iconOnly && 'sr-only')}>{entry.title}</span>
        <span
          className={cn(
            'shrink-0 rounded-pilula bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70',
            iconOnly && 'sr-only',
          )}
        >
          Em breve
        </span>
      </span>
    )
  }
  return (
    <NavLink
      to={entry.route}
      end={entry.route === '/'}
      onClick={onNavigate}
      title={iconOnly ? entry.title : undefined}
      className={({ isActive }) =>
        cn(
          itemBase,
          justify,
          isActive
            ? 'bg-azul text-white shadow-[0_4px_12px_rgba(36,87,230,0.35)]'
            : 'text-white/80 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon {...icon} className="shrink-0" />
      <span className={cn('min-w-0 flex-1', iconOnly && 'sr-only')}>{entry.title}</span>
    </NavLink>
  )
}

export interface SidebarProps {
  asideRef: Ref<HTMLElement>
  /** Só ícones (desktop recolhido). */
  iconOnly: boolean
  /** < 1024 px: gaveta off-canvas. */
  mobile: boolean
  open: boolean
  onClose: () => void
}

export function Sidebar({ asideRef, iconOnly, mobile, open, onClose }: SidebarProps) {
  const { user, logout, can } = useAuth()
  const allowed = MODULES.filter((m) => can(...m.roles))
  const onNavigate = mobile ? onClose : () => undefined

  return (
    <aside
      ref={asideRef}
      id="menu-principal"
      inert={mobile && !open}
      data-open={open || undefined}
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] -translate-x-full flex-col bg-navy text-white transition-[transform,width] duration-200 ease-out',
        'data-[open]:translate-x-0 data-[open]:shadow-dialogo',
        'lg:sticky lg:top-0 lg:h-dvh lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none',
        iconOnly ? 'lg:w-[76px]' : 'lg:w-[264px]',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', iconOnly ? 'justify-center px-2' : 'justify-between px-5')}>
        <Logo tone="onDark" size="sm" markOnly={iconOnly} className="text-white" />
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="inline-flex size-10 items-center justify-center rounded-controle text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-white"
          >
            <X {...icon} />
          </button>
        )}
      </div>

      <nav aria-label="Principal" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          <li>
            <NavEntry entry={HOME_ENTRY} iconOnly={iconOnly} onNavigate={onNavigate} />
          </li>
        </ul>
        {NAV_GROUPS.map((group) => {
          const entries = allowed.filter((m) => m.group === group.id)
          if (entries.length === 0) return null
          return (
            <div key={group.id} className="mt-6">
              {iconOnly ? (
                <div aria-hidden="true" className="mx-3 mb-3 h-px bg-white/10" />
              ) : (
                <p id={`grupo-${group.id}`} className="mb-2 px-3 text-legenda font-semibold text-white/60">
                  {group.label}
                </p>
              )}
              <ul aria-label={iconOnly ? group.label : undefined} aria-labelledby={iconOnly ? undefined : `grupo-${group.id}`} className="flex flex-col gap-1">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <NavEntry entry={entry} iconOnly={iconOnly} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {user && (
        <div className={cn('shrink-0 border-t border-white/10 p-3', iconOnly ? 'flex flex-col items-center gap-2' : 'flex items-center gap-3')}>
          <Avatar name={user.name} size="md" decorative />
          {!iconOnly && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-corpo font-semibold text-white">{user.name}</p>
              <p className="truncate text-legenda text-white/65">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            aria-label="Sair"
            title="Sair"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-controle text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white"
          >
            <LogOut {...icon} />
          </button>
        </div>
      )}
    </aside>
  )
}
