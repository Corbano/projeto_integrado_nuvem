import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../shared/ui/cn'

export interface PopoverProps {
  /** Nome acessível do botão. */
  label: string
  button: ReactNode
  /** 'menu' foca o primeiro item; 'dialog' foca o próprio painel. */
  panelRole?: 'dialog' | 'menu'
  buttonClassName?: string
  panelClassName?: string
  /** Itens com role="menuitem" fecham o painel ao serem acionados. */
  children: ReactNode
}

/** Botão + painel flutuante: Esc fecha e devolve o foco, clique fora e Tab para fora fecham. */
export function Popover({
  label,
  button,
  panelRole = 'dialog',
  buttonClassName,
  panelClassName,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[role="menuitem"], a[href], button:not([disabled])')
    ;(first ?? panel)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onFocusIn(event: FocusEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open, close])

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup={panelRole}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role={panelRole}
          aria-label={label}
          tabIndex={-1}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('[role="menuitem"]')) close()
          }}
          className={cn(
            'ac-menu-in absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-linha bg-superficie p-2 text-tinta shadow-menu outline-none',
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
