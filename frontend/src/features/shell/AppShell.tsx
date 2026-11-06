import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export const SIDEBAR_STORAGE_KEY = 'ac:sidebar-collapsed'
const MOBILE_QUERY = '(max-width: 1023px)'
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Layout das telas autenticadas: barra lateral, topo e conteúdo. Usa <Outlet /> ou `children`. */
export function AppShell({ children }: { children?: ReactNode }) {
  const mobile = useMediaQuery(MOBILE_QUERY)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [palette, setPalette] = useState<{ open: boolean; initial: string }>({ open: false, initial: '' })
  const asideRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  // Ao sair do modo gaveta (ou entrar nele) a gaveta começa fechada.
  const [lastMobile, setLastMobile] = useState(mobile)
  if (lastMobile !== mobile) {
    setLastMobile(mobile)
    setDrawerOpen(false)
  }

  const drawerVisible = mobile && drawerOpen
  const iconOnly = !mobile && collapsed

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    toggleRef.current?.focus()
  }, [])

  function toggleMenu() {
    if (mobile) {
      setDrawerOpen((open) => !open)
      return
    }
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Sem localStorage (modo privado): a preferência vale só nesta sessão.
      }
      return next
    })
  }

  // Gaveta aberta: foco vai para dentro, Esc fecha e Tab não escapa da gaveta.
  useEffect(() => {
    if (!drawerVisible) return
    const aside = asideRef.current
    if (!aside) return
    aside.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
        return
      }
      if (event.key !== 'Tab' || !aside) return
      const items = Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!aside.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerVisible, closeDrawer])

  // Atalho global Ctrl/Cmd+K.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette((current) => (current.open ? current : { open: true, initial: '' }))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    mainRef.current?.focus()
  }

  return (
    <div className="min-h-dvh bg-fundo lg:flex">
      <a
        href="#conteudo"
        onClick={skipToContent}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-controle focus:bg-navy focus:px-4 focus:py-2.5 focus:text-corpo focus:font-semibold focus:text-white"
      >
        Ir para o conteúdo
      </a>

      <Sidebar asideRef={asideRef} iconOnly={iconOnly} mobile={mobile} open={drawerVisible} onClose={closeDrawer} />
      {drawerVisible && (
        <div aria-hidden="true" onClick={closeDrawer} className="ac-fade-in fixed inset-0 z-30 bg-navy/50 lg:hidden" />
      )}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Topbar
          toggleRef={toggleRef}
          mobile={mobile}
          menuExpanded={mobile ? drawerVisible : !collapsed}
          onToggleMenu={toggleMenu}
          onOpenPalette={(initial = '') => setPalette({ open: true, initial })}
        />
        <main
          id="conteudo"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 outline-none sm:px-8 sm:py-8 lg:px-10"
        >
          {children ?? <Outlet />}
        </main>
      </div>

      <CommandPalette
        open={palette.open}
        initialQuery={palette.initial}
        onClose={() => setPalette({ open: false, initial: '' })}
      />
    </div>
  )
}
