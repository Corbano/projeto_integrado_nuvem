import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, LoaderCircle, X } from 'lucide-react'
import { cn } from './cn'
import { controlClasses } from './Input'

/** Minúsculas e sem acento, para comparar texto digitado com texto exibido. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Destaca em negrito (com fundo suave) o trecho que casa com a busca, ignorando acentos e caixa. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = fold(query.trim())
  if (!needle) return <>{text}</>
  // Só destaca quando a versão sem acentos tem o mesmo tamanho (os índices coincidem).
  const haystack = fold(text)
  if (haystack.length !== text.length) return <>{text}</>
  const start = haystack.indexOf(needle)
  if (start < 0) return <>{text}</>
  const end = start + needle.length
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-info-fundo px-0.5 font-semibold text-azul">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

export interface ComboboxFooterOption {
  label: string
  icon?: ReactNode
  onSelect: (query: string) => void
}

export interface ComboboxProps<T> {
  label: string
  /** Opção escolhida (controlado). */
  value: T | null
  onChange: (value: T | null) => void
  /** Opções a mostrar agora. Para busca assíncrona, quem usa as troca conforme `onQueryChange`. */
  options: readonly T[]
  getKey: (option: T) => string | number
  /** Texto que aparece no campo quando a opção está escolhida. */
  getText: (option: T) => string
  renderOption: (option: T, state: { query: string; active: boolean; selected: boolean }) => ReactNode
  /** Chamado a cada mudança do texto digitado (e com '' ao escolher, limpar ou sair). */
  onQueryChange?: (query: string) => void
  /** Carregando opções: mostra "Buscando…" e marca aria-busy. */
  loading?: boolean
  /** Mensagem quando não há opções (padrão: "Nenhum resultado"). */
  emptyMessage?: string
  /** Última opção fixa, ex.: "Cadastrar novo cliente". */
  footerOption?: ComboboxFooterOption
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  /** Rótulo do botão que limpa a escolha (padrão: "Limpar"). */
  clearLabel?: string
  id?: string
  className?: string
}

interface PopupPosition {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

const POPUP_MAX = 320
const MIN_SPACE_BELOW = 200

/**
 * Autocomplete acessível (padrão WAI-ARIA 1.2 "combobox com listbox"): o foco fica no campo,
 * a opção ativa é indicada por aria-activedescendant. Teclado: ↑/↓ movem (abrem se fechado),
 * Home/End vão ao primeiro/último, Enter escolhe, Esc fecha (e depois desfaz o texto), Tab sai.
 * A lista abre abaixo do campo e inverte para cima quando falta espaço (visual viewport).
 */
export function Combobox<T>({
  label,
  value,
  onChange,
  options,
  getKey,
  getText,
  renderOption,
  onQueryChange,
  loading = false,
  emptyMessage = 'Nenhum resultado',
  footerOption,
  error,
  hint,
  required,
  disabled,
  placeholder,
  clearLabel = 'Limpar',
  id,
  className,
}: ComboboxProps<T>) {
  const uid = useId()
  const inputId = id ?? `combobox-${uid}`
  const listId = `${inputId}-lista`
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const optionId = (index: number) => `${inputId}-opcao-${index}`

  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<PopupPosition | null>(null)

  const query = typing ? text : ''
  const display = typing ? text : value ? getText(value) : ''
  const itemCount = options.length + (footerOption ? 1 : 0)
  const safeActive = activeIndex < itemCount ? activeIndex : -1
  const showClear = !disabled && (typing ? text.length > 0 : value !== null)

  const reposition = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const below = viewportHeight - rect.bottom - 12
    const above = rect.top - 12
    const flip = below < MIN_SPACE_BELOW && above > below
    setPosition(
      flip
        ? { bottom: viewportHeight - rect.top + 6, left: rect.left, width: rect.width, maxHeight: Math.min(POPUP_MAX, above) }
        : { top: rect.bottom + 6, left: rect.left, width: rect.width, maxHeight: Math.min(POPUP_MAX, Math.max(below, 140)) },
    )
  }, [])

  useLayoutEffect(() => {
    if (open) reposition()
  }, [open, reposition, itemCount, loading])

  useEffect(() => {
    if (!open) return
    const handler = () => reposition()
    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    window.visualViewport?.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
      window.visualViewport?.removeEventListener('resize', handler)
    }
  }, [open, reposition])

  useEffect(() => {
    if (open && safeActive >= 0) {
      document.getElementById(optionId(safeActive))?.scrollIntoView?.({ block: 'nearest' })
    }
    // optionId depende só de inputId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeActive])

  function openList() {
    if (!disabled) setOpen(true)
  }

  function closeList() {
    setOpen(false)
    setActiveIndex(-1)
  }

  function resetText() {
    setTyping(false)
    setText('')
    onQueryChange?.('')
  }

  function choose(option: T) {
    onChange(option)
    resetText()
    closeList()
  }

  function chooseFooter() {
    if (!footerOption) return
    const typed = query
    closeList()
    resetText()
    footerOption.onSelect(typed)
  }

  function chooseAt(index: number) {
    if (index < options.length) choose(options[index])
    else chooseFooter()
  }

  function clear() {
    onChange(null)
    resetText()
    closeList()
    inputRef.current?.focus()
  }

  function onInputChange(next: string) {
    setTyping(true)
    setText(next)
    setActiveIndex(-1)
    openList()
    onQueryChange?.(next)
  }

  function move(step: 1 | -1) {
    if (itemCount === 0) return
    setActiveIndex((current) => {
      const index = current < itemCount ? current : -1
      if (index === -1) return step === 1 ? 0 : itemCount - 1
      return (index + step + itemCount) % itemCount
    })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (!open) {
          openList()
          if (!event.altKey) setActiveIndex(event.key === 'ArrowDown' ? 0 : itemCount - 1)
        } else if (!event.altKey) {
          move(event.key === 'ArrowDown' ? 1 : -1)
        }
        break
      case 'Home':
      case 'End':
        if (open && itemCount > 0) {
          event.preventDefault()
          setActiveIndex(event.key === 'Home' ? 0 : itemCount - 1)
        }
        break
      case 'Enter':
        if (open) {
          event.preventDefault()
          if (safeActive >= 0) chooseAt(safeActive)
        }
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          event.stopPropagation()
          closeList()
        } else if (typing) {
          event.preventDefault()
          event.stopPropagation()
          resetText()
        }
        break
      case 'Tab':
        closeList()
        break
    }
  }

  const statusMessage = !open
    ? ''
    : loading
      ? 'Buscando resultados…'
      : options.length === 0
        ? `${emptyMessage}.`
        : `${options.length} ${options.length === 1 ? 'resultado disponível' : 'resultados disponíveis'}`

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-mini font-semibold text-tinta">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-critico-texto">
            *
          </span>
        )}
      </label>
      <div ref={wrapperRef} className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && safeActive >= 0 ? optionId(safeActive) : undefined}
          aria-busy={loading || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          disabled={disabled}
          placeholder={placeholder}
          value={display}
          onChange={(event) => onInputChange(event.target.value)}
          onFocus={openList}
          onClick={openList}
          onBlur={() => {
            closeList()
            if (typing) resetText()
          }}
          onKeyDown={onKeyDown}
          className={cn(controlClasses, 'pr-[4.75rem] max-sm:text-[16px]')}
        />
        <span className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
          {loading && open && (
            <LoaderCircle aria-hidden="true" size={16} strokeWidth={2} className="mr-1 animate-spin text-tinta-suave" />
          )}
          {showClear && (
            <button
              type="button"
              aria-label={clearLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clear}
              className="inline-flex size-9 items-center justify-center rounded-controle text-tinta-suave hover:bg-fundo hover:text-tinta"
            >
              <X aria-hidden="true" size={16} strokeWidth={2} />
            </button>
          )}
          <ChevronDown
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
            className={cn('mr-2 text-tinta-suave transition-transform', open && 'rotate-180')}
          />
        </span>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-mini text-tinta-suave">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-mini font-medium text-critico-texto">
          {error}
        </p>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            // O foco nunca sai do campo: clicar na lista não pode causar blur.
            onMouseDown={(event) => event.preventDefault()}
            style={{
              position: 'fixed',
              top: position?.top,
              bottom: position?.bottom,
              left: position?.left ?? 0,
              width: position?.width,
              maxHeight: position?.maxHeight,
              visibility: position ? 'visible' : 'hidden',
            }}
            data-placement={position?.bottom !== undefined ? 'top' : 'bottom'}
            className="ac-menu-in z-[80] flex flex-col overflow-hidden rounded-controle border border-linha bg-superficie shadow-menu"
          >
            {options.length === 0 && (
              <p aria-hidden="true" className="px-4 py-4 text-center text-corpo text-tinta-suave">
                {loading ? 'Buscando…' : emptyMessage}
              </p>
            )}
            <ul
              id={listId}
              role="listbox"
              aria-label={label}
              aria-busy={loading || undefined}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 empty:hidden"
            >
              {options.map((option, index) => {
                const active = safeActive === index
                const selected = value !== null && getKey(value) === getKey(option)
                return (
                  <li
                    key={getKey(option)}
                    id={optionId(index)}
                    role="option"
                    aria-selected={active}
                    data-chosen={selected || undefined}
                    onMouseMove={() => !active && setActiveIndex(index)}
                    onClick={() => choose(option)}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-corpo text-tinta',
                      active && 'bg-info-fundo',
                    )}
                  >
                    <span className="min-w-0 flex-1">{renderOption(option, { query, active, selected })}</span>
                    {selected && <Check aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-azul" />}
                  </li>
                )
              })}
              {footerOption && (
                <li
                  id={optionId(options.length)}
                  role="option"
                  aria-selected={safeActive === options.length}
                  onMouseMove={() => safeActive !== options.length && setActiveIndex(options.length)}
                  onClick={chooseFooter}
                  className={cn(
                    'mt-1 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-t border-linha px-3 py-2 text-corpo font-semibold text-azul',
                    safeActive === options.length && 'bg-info-fundo',
                  )}
                >
                  {footerOption.icon && (
                    <span aria-hidden="true" className="flex shrink-0 [&_svg]:size-[18px]">
                      {footerOption.icon}
                    </span>
                  )}
                  {footerOption.label}
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}
