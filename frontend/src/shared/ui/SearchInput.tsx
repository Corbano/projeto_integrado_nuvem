import { Search } from 'lucide-react'
import { Input } from './Input'
import type { InputProps } from './Input'

export interface SearchInputProps extends Omit<InputProps, 'type' | 'leadingIcon' | 'trailing'> {
  /** Dica visual de atalho (ex.: "⌘K"). Quem usa registra o atalho; aqui só mostramos e expomos aria-keyshortcuts. */
  shortcutHint?: string
  /** Valor de aria-keyshortcuts (ex.: "Meta+K Control+K"). */
  keyShortcuts?: string
}

/** Campo de busca com lupa. Precisa de rótulo: aria-label ou um <Field>. */
export function SearchInput({ shortcutHint, keyShortcuts, ...rest }: SearchInputProps) {
  return (
    <Input
      {...rest}
      type="search"
      aria-keyshortcuts={keyShortcuts}
      leadingIcon={<Search strokeWidth={1.75} />}
      trailing={
        shortcutHint ? (
          <kbd
            aria-hidden="true"
            className="pointer-events-none mr-1 rounded-md border border-linha bg-fundo px-1.5 py-0.5 font-sans text-legenda font-semibold text-tinta-suave"
          >
            {shortcutHint}
          </kbd>
        ) : undefined
      }
    />
  )
}
