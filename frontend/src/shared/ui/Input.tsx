import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/** Visual comum a Input e Select: raio 10, borda >= 3:1, foco azul de 2 px com halo suave. */
export const controlClasses =
  'min-h-11 w-full rounded-controle border border-borda-campo bg-superficie px-3 font-sans text-corpo text-tinta ' +
  'placeholder:text-tinta-suave transition-[border-color,box-shadow] duration-150 hover:border-tinta-suave ' +
  'focus:outline-none focus-visible:outline-none focus:border-azul focus:shadow-foco ' +
  'aria-[invalid=true]:border-critico-texto aria-[invalid=true]:shadow-[0_0_0_1px_var(--color-critico-texto)] ' +
  'aria-[invalid=true]:focus:shadow-foco-erro ' +
  'disabled:cursor-not-allowed disabled:bg-fundo disabled:opacity-70'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Ícone decorativo à esquerda (ex.: <Mail {...icon} />). */
  leadingIcon?: ReactNode
  /** Conteúdo à direita, dentro do campo (ex.: botão de mostrar senha, dica de atalho). */
  trailing?: ReactNode
  wrapperClassName?: string
}

export function Input({ className, leadingIcon, trailing, wrapperClassName, ...rest }: InputProps) {
  if (!leadingIcon && !trailing) return <input {...rest} className={cn(controlClasses, className)} />
  return (
    <div className={cn('relative', wrapperClassName)}>
      {leadingIcon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-tinta-suave [&_svg]:size-[18px]"
        >
          {leadingIcon}
        </span>
      )}
      <input
        {...rest}
        className={cn(controlClasses, leadingIcon ? 'pl-10' : null, trailing ? 'pr-12' : null, className)}
      />
      {trailing && <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>}
    </div>
  )
}
