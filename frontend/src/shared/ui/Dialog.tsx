import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children?: ReactNode
  /** Botoes de acao, alinhados a direita no rodape. */
  footer?: ReactNode
  /**
   * Quando false, Esc e clique no fundo nao fecham (ex.: enquanto salva).
   * O fechamento fica por conta dos botoes do dialogo.
   */
  dismissible?: boolean
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog(props: DialogProps) {
  return props.open ? <OpenDialog {...props} /> : null
}

function OpenDialog({
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  className,
}: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onDocKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onDocKey)

    return () => {
      document.removeEventListener('keydown', onDocKey)
      document.body.style.overflow = previousOverflow
      if (opener && opener.isConnected) opener.focus()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) {
      event.preventDefault()
      panel.focus()
      return
    }
    const firstItem = items[0]
    const lastItem = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === firstItem || active === panel)) {
      event.preventDefault()
      lastItem.focus()
    } else if (!event.shiftKey && active === lastItem) {
      event.preventDefault()
      firstItem.focus()
    }
  }

  return createPortal(
    <div
      className="ac-fade-in fixed inset-0 z-50 flex items-center justify-center bg-chassi/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'ac-dialog-in max-h-full w-full max-w-lg overflow-y-auto rounded-dialogo border border-risco bg-bancada p-6 text-chassi shadow-xl',
          className,
        )}
      >
        <h2 id={titleId} className="font-display text-secao font-semibold">
          {title}
        </h2>
        {children && <div className="mt-3 text-corpo">{children}</div>}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
