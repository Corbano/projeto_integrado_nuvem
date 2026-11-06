import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'info' | 'error'

export interface ToastApi {
  success: (message: string) => void
  info: (message: string) => void
  error: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
