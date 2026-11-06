import type { InputHTMLAttributes } from 'react'
import { cn } from './cn'

export const controlClasses =
  'min-h-11 w-full rounded-campo border border-borda-campo bg-bancada px-3 font-sans text-corpo text-chassi ' +
  'placeholder:text-chassi-suave aria-[invalid=true]:border-freio-texto aria-[invalid=true]:border-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...rest }: InputProps) {
  return <input {...rest} className={cn(controlClasses, className)} />
}
