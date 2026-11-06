import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Ellipsis } from 'lucide-react'
import { cn } from './cn'

export interface RowAction {
  label: string
  onSelect: () => void
  icon?: ReactNode
  /** Ação destrutiva: texto em vermelho. */
  danger?: boolean
  disabled?: boolean
}

export interface RowActionsProps {
  /** Nome do item da linha, para o rótulo do botão: "Ações de {label}". */
  label: string
  actions: RowAction[]
  className?: string
}

interface Position {
  top: number
  right: number
}

/**
 * Botão "⋯" com menu de ações da linha (padrão WAI-ARIA menu button).
 * Teclado: Enter/Espaço/↓ abrem no primeiro item, ↑ abre no último; ↑/↓, Home/End navegam;
 * Esc fecha e devolve o foco; Tab fecha. Não usar dentro de Dialog (o menu vai para um portal).
 */
export function RowActions({ label, actions, className }: RowActionsProps) {
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const [position, setPosition] = useState<Position | null>(null)

  const enabled = actions.map((a, i) => (a.disabled ? -1 : i)).filter((i) => i >= 0)

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  function openAt(index: number) {
    setFocusIndex(index)
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? 0
    const below = rect.bottom + 6
    const top = below + menuHeight > window.innerHeight - 8 ? Math.max(8, rect.top - 6 - menuHeight) : below
    setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) })
  }, [open])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[focusIndex]?.focus()
  }, [open, focusIndex, position])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false)
    }
    function onViewportChange() {
      close(false)
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open, close])

  function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    // Enter/Espaço viram clique nativo (onClick abre no primeiro item).
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openAt(enabled[0] ?? 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAt(enabled[enabled.length - 1] ?? 0)
    }
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const pos = enabled.indexOf(focusIndex)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusIndex(enabled[(pos + 1) % enabled.length])
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusIndex(enabled[(pos - 1 + enabled.length) % enabled.length])
    } else if (event.key === 'Home') {
      event.preventDefault()
      setFocusIndex(enabled[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      setFocusIndex(enabled[enabled.length - 1])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  function select(action: RowAction) {
    if (action.disabled) return
    close(true)
    action.onSelect()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Ações de ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openAt(enabled[0] ?? 0))}
        onKeyDown={onTriggerKey}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-controle text-tinta-suave transition-colors',
          'hover:bg-fundo hover:text-tinta aria-expanded:bg-fundo aria-expanded:text-tinta',
          className,
        )}
      >
        <Ellipsis aria-hidden="true" size={20} strokeWidth={1.75} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Ações de ${label}`}
            onKeyDown={onMenuKey}
            style={{
              position: 'fixed',
              top: position?.top ?? 0,
              right: position?.right ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="ac-menu-in z-[70] min-w-48 rounded-controle border border-linha bg-superficie p-1.5 shadow-menu"
          >
            {actions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                tabIndex={index === focusIndex ? 0 : -1}
                aria-disabled={action.disabled || undefined}
                onClick={() => select(action)}
                onMouseEnter={() => !action.disabled && setFocusIndex(index)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-corpo font-medium outline-none',
                  'focus-visible:bg-fundo [&_svg]:size-4 [&_svg]:shrink-0',
                  action.danger ? 'text-critico-texto focus:bg-critico-fundo' : 'text-tinta focus:bg-fundo',
                  action.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {action.icon && <span aria-hidden="true" className="flex">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
