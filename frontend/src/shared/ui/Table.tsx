import { Children, cloneElement, isValidElement, useEffect, useRef } from 'react'
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from './cn'

export type RowStatus = 'neutral' | 'active' | 'inactive' | 'attention' | 'critical' | 'ok'
export type SortDirection = 'asc' | 'desc' | 'none'

const statusBar: Record<RowStatus, string> = {
  neutral: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-linha)]',
  active: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-azul)]',
  inactive: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-borda-campo)]',
  attention: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-atencao)]',
  critical: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-critico)]',
  ok: '[&>:first-child]:shadow-[inset_3px_0_0_0_var(--color-ok)]',
}

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Sem borda/sombra própria, para usar dentro de um Card. */
  bare?: boolean
}

export function Table({ bare = false, className, children, ...rest }: TableProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto',
        !bare && 'rounded-card border border-linha bg-superficie shadow-card',
      )}
    >
      <table {...rest} className={cn('w-full border-collapse text-left text-corpo tabular-nums', className)}>
        {children}
      </table>
    </div>
  )
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Coluna ordenável: mostra o indicador e expõe aria-sort. Exige onSort. */
  sort?: SortDirection
  onSort?: () => void
}

const ariaSort = { asc: 'ascending', desc: 'descending', none: 'none' } as const

export function Th({ scope = 'col', sort, onSort, className, children, ...rest }: ThProps) {
  const sortable = Boolean(onSort)
  const direction = sort ?? 'none'
  const SortIcon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown
  return (
    <th
      {...rest}
      scope={scope}
      aria-sort={sortable ? ariaSort[direction] : undefined}
      className={cn(
        'h-11 border-b border-linha bg-fundo px-4 font-sans text-mini font-semibold whitespace-nowrap text-tinta-suave',
        'first:rounded-tl-[15px] last:rounded-tr-[15px]',
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-linha/70 hover:text-tinta',
            direction !== 'none' && 'text-tinta',
          )}
        >
          {children}
          <SortIcon
            aria-hidden="true"
            size={14}
            strokeWidth={2}
            className={cn(direction === 'none' ? 'text-borda-campo group-hover:text-tinta-suave' : 'text-azul')}
          />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest} className={cn('px-4 py-3.5 align-middle text-tinta', className)} />
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Barra de status de 3 px na borda esquerda da linha. */
  status?: RowStatus
  /**
   * Texto so para leitores de tela, na primeira celula, para o estado nao depender so de cor.
   * As paginas tambem devem mostrar uma StatusPill visivel.
   */
  statusLabel?: string
  selected?: boolean
}

export function Tr({ status, statusLabel, selected, className, children, ...rest }: TrProps) {
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
      data-selected={selected || undefined}
      className={cn(
        'border-b border-linha transition-colors last:border-b-0 hover:bg-fundo/70',
        selected && 'bg-info-fundo/60 hover:bg-info-fundo',
        status && statusBar[status],
        className,
      )}
    >
      {content}
    </tr>
  )
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean
}

/** Caixa de seleção nativa no tom azul (estado misto via `indeterminate`). */
export function Checkbox({ indeterminate = false, className, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      {...rest}
      ref={ref}
      type="checkbox"
      className={cn('size-4 cursor-pointer rounded accent-azul disabled:cursor-not-allowed', className)}
    />
  )
}

/** Célula de cabeçalho com "selecionar todas". */
export function ThCheckbox({ className, ...props }: CheckboxProps) {
  return (
    <th
      scope="col"
      className={cn('h-11 w-12 border-b border-linha bg-fundo pr-0 pl-4 first:rounded-tl-[15px]', className)}
    >
      <span className="flex items-center">
        <Checkbox aria-label="Selecionar todas as linhas" {...props} />
      </span>
    </th>
  )
}

/** Célula de seleção da linha. Passe um aria-label que identifique a linha (ex.: "Selecionar Ana"). */
export function TdCheckbox({ className, ...props }: CheckboxProps) {
  return (
    <td className={cn('w-12 pr-0 pl-4 align-middle', className)}>
      <span className="flex items-center">
        <Checkbox {...props} />
      </span>
    </td>
  )
}
