import { Children, cloneElement, isValidElement } from 'react'
import type { HTMLAttributes, ReactElement, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from './cn'

export type RowStatus = 'neutral' | 'active' | 'inactive' | 'attention' | 'critical' | 'ok'

const statusBar: Record<RowStatus, string> = {
  neutral: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-risco)]',
  active: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-esmalte)]',
  inactive: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-borda-campo)]',
  attention: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-oleo)]',
  critical: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-freio)]',
  ok: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-sinal)]',
}

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-placa border border-risco bg-bancada">
      <table {...rest} className={cn('w-full border-collapse text-left text-corpo tabular-nums', className)}>
        {children}
      </table>
    </div>
  )
}

export function Th({ scope = 'col', className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      scope={scope}
      className={cn(
        'border-b border-risco bg-concreto/60 px-4 py-3 font-sans text-mini font-semibold text-chassi-suave',
        className,
      )}
    />
  )
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest} className={cn('px-4 py-3 align-middle', className)} />
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Barra de status de 3 px na borda esquerda da linha. */
  status?: RowStatus
  /**
   * Texto so para leitores de tela, na primeira celula, para o estado nao depender so de cor.
   * As paginas tambem devem mostrar um Badge visivel.
   */
  statusLabel?: string
}

export function Tr({ status, statusLabel, className, children, ...rest }: TrProps) {
  let content = children
  if (statusLabel) {
    const [first, ...others] = Children.toArray(children)
    if (isValidElement<{ children?: ReactNode }>(first)) {
      content = [
        cloneElement(
          first as ReactElement<{ children?: ReactNode }>,
          { key: 'status-cell' },
          <span key="status-label" className="sr-only">
            {statusLabel}{' '}
          </span>,
          first.props.children,
        ),
        ...others,
      ]
    }
  }
  return (
    <tr
      {...rest}
      data-status={status}
      className={cn('border-b border-risco last:border-b-0', status && statusBar[status], className)}
    >
      {content}
    </tr>
  )
}
