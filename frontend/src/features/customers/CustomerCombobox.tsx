import { useEffect, useRef, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Combobox, Highlight } from '../../shared/ui'
import { useAuth } from '../auth/useAuth'
import { useCustomer, useCustomerSearch } from './api'
import type { Customer, CustomerSummary } from './api'
import { CustomerFormDialog } from './CustomerFormDialog'
import type { CustomerPrefill } from './CustomerFormDialog'
import { documentType, formatDocument, formatPhone, onlyDigits } from './format'

const SEARCH_DELAY_MS = 250
const RESULT_LIMIT = 8

export interface CustomerComboboxProps {
  value: CustomerSummary | null
  onChange: (customer: CustomerSummary | null) => void
  /** Cliente já escolhido por id (ex.: vindo de uma URL): é carregado e entregue via onChange uma vez. */
  initialCustomerId?: number | string | null
  label?: string
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  placeholder?: string
  id?: string
  className?: string
  /** Oferece "Cadastrar novo cliente" (padrão: só para quem pode cadastrar). */
  allowCreate?: boolean
}

/** Texto digitado vira CPF/CNPJ quando parece um documento (só números e máscara, 3+ dígitos); senão, nome. */
function prefillFrom(query: string): CustomerPrefill {
  const typed = query.trim()
  if (!typed) return {}
  const digits = onlyDigits(typed)
  if (digits.length >= 3 && /^[\d.\-/\s]+$/.test(typed)) return { document: formatDocument(digits) }
  return { name: typed }
}

/**
 * Autocompletar de clientes: busca na API enquanto se digita (250 ms), destaca o trecho encontrado
 * e permite cadastrar um cliente novo sem sair da tela. Reutilizável em veículos, check-in e ordens.
 */
export function CustomerCombobox({
  value,
  onChange,
  initialCustomerId,
  label = 'Cliente',
  required,
  disabled,
  error,
  hint,
  placeholder = 'Buscar por nome, CPF/CNPJ ou telefone',
  id,
  className,
  allowCreate,
}: CustomerComboboxProps) {
  const { can } = useAuth()
  const canCreate = allowCreate ?? can('admin', 'reception')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [creating, setCreating] = useState<CustomerPrefill | null>(null)

  // Busca com atraso; a lista vazia ('' ) mostra os primeiros clientes em ordem de cadastro.
  useEffect(() => {
    if (query === debounced) return
    const timer = setTimeout(() => setDebounced(query), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query, debounced])

  const search = useCustomerSearch(debounced.trim(), RESULT_LIMIT, !disabled)
  const waiting = query.trim() !== debounced.trim()
  const loading = waiting || (search.isFetching && !search.data) || search.isPlaceholderData

  // Cliente inicial por id: carrega uma vez e entrega ao formulário.
  const initial = useCustomer(value === null ? initialCustomerId : null)
  const delivered = useRef<string | null>(null)
  useEffect(() => {
    const loaded = initial.data
    if (!loaded || value !== null || delivered.current === String(loaded.id)) return
    delivered.current = String(loaded.id)
    onChange(loaded)
  }, [initial.data, value, onChange])

  const options: CustomerSummary[] = search.data?.items ?? []

  return (
    <>
      <Combobox<CustomerSummary>
        id={id}
        className={className}
        label={label}
        required={required}
        disabled={disabled}
        error={error}
        hint={hint}
        placeholder={placeholder}
        clearLabel="Limpar cliente"
        value={value}
        onChange={onChange}
        options={options}
        loading={loading}
        emptyMessage="Nenhum cliente encontrado"
        getKey={(customer) => customer.id}
        getText={(customer) => customer.name}
        onQueryChange={setQuery}
        renderOption={(customer, { query: typed }) => (
          <span className="block min-w-0">
            <span className="block truncate font-semibold">
              <Highlight text={customer.name} query={typed} />
            </span>
            <span className="block truncate text-legenda text-tinta-suave">
              {documentType(customer.document)} <Highlight text={formatDocument(customer.document)} query={typed} />
              {customer.phone ? <> · {formatPhone(customer.phone)}</> : null}
            </span>
          </span>
        )}
        footerOption={
          canCreate
            ? {
                label: 'Cadastrar novo cliente',
                icon: <UserPlus strokeWidth={1.75} />,
                onSelect: (typed) => setCreating(prefillFrom(typed)),
              }
            : undefined
        }
      />
      <CustomerFormDialog
        open={creating !== null}
        prefill={creating ?? undefined}
        onClose={() => setCreating(null)}
        onSaved={(customer: Customer) => onChange(customer)}
      />
    </>
  )
}
