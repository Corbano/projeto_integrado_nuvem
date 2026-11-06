import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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

// Pilha de dialogos abertos: so o do topo trata Esc, Tab e clique no fundo.
const stack: object[] = []

// Trava de scroll com contagem de referencias: so restaura quando o ultimo dialogo fecha.
let scrollLocks = 0
let savedOverflow = ''

function lockScroll() {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = savedOverflow
}

// inert nos irmaos do portal, com contagem por elemento para suportar dialogos aninhados.
const inertCounts = new Map<Element, { count: number; wasInert: boolean }>()

function makeInert(except: Element) {
  const marked: Element[] = []
  for (const el of Array.from(document.body.children)) {
    if (el === except || el.tagName === 'SCRIPT') continue
    const entry = inertCounts.get(el)
    if (entry) entry.count++
    else {
      inertCounts.set(el, { count: 1, wasInert: el.hasAttribute('inert') })
      el.setAttribute('inert', '')
    }
    marked.push(el)
  }
  return () => {
    for (const el of marked) {
      const entry = inertCounts.get(el)
      if (!entry) continue
      if (--entry.count === 0) {
        inertCounts.delete(el)
        if (!entry.wasInert) el.removeAttribute('inert')
      }
    }
  }
}

function focusables(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
}

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
  const overlayRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  // Lido na montagem, antes de qualquer autoFocus dos filhos.
  const [opener] = useState<HTMLElement | null>(() =>
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null,
  )
  const [token] = useState(() => ({}))

  // Sem deps: depois de cada render, se o foco caiu para fora (ex.: botao focado ficou desabilitado), volta ao painel.
  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
    const panel = panelRef.current
    const active = document.activeElement
    if (panel && stack[stack.length - 1] === token && (!active || !panel.contains(active))) {
      panel.focus()
    }
  })

  useEffect(() => {
    stack.push(token)
    const panel = panelRef.current
    const overlay = overlayRef.current
    if (panel) {
      const preferred =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        (panel.contains(document.activeElement) && document.activeElement !== panel
          ? (document.activeElement as HTMLElement)
          : null) ??
        focusables(panel)[0]
      ;(preferred ?? panel).focus()
    }
    lockScroll()
    const restoreInert = overlay ? makeInert(overlay) : () => {}

    const isTop = () => stack[stack.length - 1] === token

    function onDocKey(event: globalThis.KeyboardEvent) {
      if (!isTop()) return
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = focusables(panel)
      const active = document.activeElement
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (!active || !panel.contains(active) || active === panel) {
        event.preventDefault()
        ;(event.shiftKey ? lastItem : firstItem).focus()
      } else if (event.shiftKey && active === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    function onFocusIn(event: FocusEvent) {
      if (!isTop() || !panel) return
      if (event.target instanceof Node && !panel.contains(event.target)) {
        ;(focusables(panel)[0] ?? panel).focus()
      }
    }

    document.addEventListener('keydown', onDocKey)
    document.addEventListener('focusin', onFocusIn)

    return () => {
      document.removeEventListener('keydown', onDocKey)
      document.removeEventListener('focusin', onFocusIn)
      const index = stack.indexOf(token)
      if (index >= 0) stack.splice(index, 1)
      restoreInert()
      unlockScroll()
      if (opener && opener.isConnected) opener.focus()
    }
  }, [token, opener])

  return createPortal(
    <div
      ref={overlayRef}
      className="ac-fade-in fixed inset-0 z-50 flex items-center justify-center bg-chassi/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible && stack[stack.length - 1] === token) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
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
