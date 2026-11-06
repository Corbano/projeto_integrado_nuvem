import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CircleCheck, CircleX, Info, X } from 'lucide-react'
import { cn } from './cn'
import { ToastContext } from './toastContext'
import type { ToastApi, ToastKind } from './toastContext'

const AUTO_DISMISS_MS = 5000
let nextToastId = 1

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const kinds: Record<ToastKind, { Icon: typeof CircleCheck; badge: string }> = {
  success: { Icon: CircleCheck, badge: 'bg-ok-fundo text-ok-texto' },
  info: { Icon: Info, badge: 'bg-info-fundo text-azul' },
  error: { Icon: CircleX, badge: 'bg-critico-fundo text-critico-texto' },
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const remaining = useRef(AUTO_DISMISS_MS)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { id } = toast
  const kind = kinds[toast.kind]

  const start = useCallback(() => {
    startedAt.current = Date.now()
    timer.current = setTimeout(() => onDismiss(id), remaining.current)
  }, [id, onDismiss])

  const pause = useCallback(() => {
    if (timer.current === undefined) return
    clearTimeout(timer.current)
    timer.current = undefined
    remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current))
  }, [])

  const resume = useCallback(() => {
    if (timer.current === undefined) start()
  }, [start])

  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start])

  return (
    <div
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className="ac-toast-in flex items-start gap-3 rounded-card border border-linha bg-superficie p-3 pl-3.5 text-corpo text-tinta shadow-dialogo"
    >
      <span
        aria-hidden="true"
        className={cn('mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full', kind.badge)}
      >
        <kind.Icon size={20} strokeWidth={1.75} />
      </span>
      <p className="min-w-0 flex-1 py-2 font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Fechar aviso"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-controle text-tinta-suave transition-colors hover:bg-fundo hover:text-tinta"
      >
        <X aria-hidden="true" size={18} strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const api = useMemo<ToastApi>(() => {
    const push = (kind: ToastKind) => (message: string) => {
      const id = nextToastId++
      setToasts((list) => [...list, { id, kind, message }])
    }
    return { success: push('success'), info: push('info'), error: push('error') }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96">
        {/* Regioes vivas persistentes: precisam existir antes do conteudo para o leitor de tela anunciar. */}
        <div role="status" aria-live="polite" className="flex w-full flex-col items-end gap-2">
          {toasts
            .filter((t) => t.kind !== 'error')
            .map((toast) => (
              <div key={toast.id} className="pointer-events-auto w-full">
                <ToastView toast={toast} onDismiss={dismiss} />
              </div>
            ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex w-full flex-col items-end gap-2">
          {toasts
            .filter((t) => t.kind === 'error')
            .map((toast) => (
              <div key={toast.id} className="pointer-events-auto w-full">
                <ToastView toast={toast} onDismiss={dismiss} />
              </div>
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}
