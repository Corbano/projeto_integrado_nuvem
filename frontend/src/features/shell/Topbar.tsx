import { Bell, ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import type { KeyboardEvent, Ref } from 'react'
import { useLocation } from 'react-router-dom'
import { Avatar, Breadcrumb, icon, SearchInput } from '../../shared/ui'
import type { BreadcrumbItem } from '../../shared/ui'
import { useAuth } from '../auth/useAuth'
import { findModuleByPath } from './modules'
import { Popover } from './Popover'
import { ROLE_LABELS } from './roleLabels'

const iconButton =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-controle text-tinta-suave transition-colors hover:bg-fundo hover:text-tinta'

function useBreadcrumb(): BreadcrumbItem[] {
  const { pathname } = useLocation()
  if (pathname === '/') return [{ label: 'Início' }]
  const current = findModuleByPath(pathname)
  if (!current) return [{ label: 'Início', to: '/' }, { label: 'Página não encontrada' }]
  // Em páginas internas (ex.: /clientes/7) o módulo vira link e a última migalha é "Detalhes".
  if (pathname !== current.route) {
    return [{ label: 'Início', to: '/' }, { label: current.title, to: current.route }, { label: 'Detalhes' }]
  }
  return [{ label: 'Início', to: '/' }, { label: current.title }]
}

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)

export interface TopbarProps {
  toggleRef: Ref<HTMLButtonElement>
  mobile: boolean
  /** Desktop: menu só com ícones. Mobile: gaveta aberta. */
  menuExpanded: boolean
  onToggleMenu: () => void
  onOpenPalette: (initialQuery?: string) => void
}

export function Topbar({ toggleRef, mobile, menuExpanded, onToggleMenu, onOpenPalette }: TopbarProps) {
  const { user, logout } = useAuth()
  const breadcrumb = useBreadcrumb()

  const toggleLabel = mobile ? 'Abrir menu' : menuExpanded ? 'Recolher menu' : 'Expandir menu'
  const ToggleIcon = mobile ? Menu : menuExpanded ? PanelLeftClose : PanelLeftOpen

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault()
      onOpenPalette()
    } else if (event.key.length === 1) {
      event.preventDefault()
      onOpenPalette(event.key)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-linha bg-superficie/90 px-3 backdrop-blur sm:gap-3 sm:px-6">
      <button
        ref={toggleRef}
        type="button"
        aria-label={toggleLabel}
        aria-expanded={menuExpanded}
        aria-controls="menu-principal"
        onClick={onToggleMenu}
        className={iconButton}
      >
        <ToggleIcon {...icon} />
      </button>
      <span aria-hidden="true" className="hidden h-6 w-px bg-linha sm:block" />
      <Breadcrumb items={breadcrumb} className="hidden min-w-0 sm:block" />

      <div className="flex min-w-0 flex-1 justify-center">
        <div className="hidden w-full max-w-md md:block">
          <SearchInput
            readOnly
            aria-label="Buscar funcionalidade"
            placeholder="Buscar funcionalidade…"
            shortcutHint={isMac ? '⌘K' : 'Ctrl K'}
            keyShortcuts="Control+K Meta+K"
            onClick={() => onOpenPalette()}
            onKeyDown={onSearchKeyDown}
            className="cursor-pointer bg-fundo"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="Buscar funcionalidade"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={() => onOpenPalette()}
          className={`${iconButton} md:hidden`}
        >
          <Search {...icon} />
        </button>

        <Popover label="Notificações" button={<Bell {...icon} />} buttonClassName={iconButton}>
          <div className="px-3 py-4">
            <p className="text-corpo font-semibold text-tinta">Avisos</p>
            <p className="mt-1 text-corpo text-tinta-suave">Nenhum aviso por enquanto.</p>
          </div>
        </Popover>

        {user && (
          <Popover
            label="Menu do usuário"
            panelRole="menu"
            buttonClassName="inline-flex min-h-10 items-center gap-2 rounded-controle py-1 pr-2 pl-1 transition-colors hover:bg-fundo"
            button={
              <>
                <Avatar name={user.name} size="md" decorative />
                <span className="hidden min-w-0 text-left lg:block">
                  <span className="block max-w-36 truncate text-corpo font-semibold leading-tight text-tinta">{user.name}</span>
                  <span className="block text-legenda leading-tight text-tinta-suave">{ROLE_LABELS[user.role]}</span>
                </span>
                <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} className="hidden text-tinta-suave sm:block" />
              </>
            }
          >
            <div>
                <div className="px-3 pt-2 pb-3">
                  <p className="truncate text-corpo font-semibold text-tinta">{user.name}</p>
                  <p className="truncate text-legenda text-tinta-suave">{user.email}</p>
                  <p className="mt-0.5 text-legenda text-tinta-suave">{ROLE_LABELS[user.role]}</p>
                </div>
                <div className="border-t border-linha pt-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex min-h-10 w-full items-center gap-2.5 rounded-controle px-3 text-left text-corpo font-medium text-critico-texto hover:bg-critico-fundo"
                  >
                    <LogOut {...icon} size={18} />
                    Sair
                  </button>
                </div>
              </div>
          </Popover>
        )}
      </div>
    </header>
  )
}
