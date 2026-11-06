import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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

const kindClasses: Record<ToastKind, string> = {
  success: 'border-l-sinal',
  info: 'border-l-esmalte',
  error: 'border-l-freio',
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const remaining = useRef(AUTO_DISMISS_MS)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { id } = toast

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
      className={cn(
        'ac-toast-in flex items-start gap-3 rounded-campo border border-risco border-l-4 bg-bancada p-3 text-corpo text-chassi shadow-lg',
        kindClasses[toast.kind],
      )}
    >
      <p className="min-w-0 flex-1 py-2">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Fechar aviso"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-campo text-chassi-suave hover:bg-risco/50 hover:text-chassi"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
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
