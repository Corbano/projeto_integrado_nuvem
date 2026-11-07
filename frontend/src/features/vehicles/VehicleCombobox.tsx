import { useEffect, useState } from 'react'
import { Combobox, Highlight } from '../../shared/ui'
import { normalizePlate } from '../../shared/ui/plateFormat'
import { useVehicles } from './api'
import type { Vehicle } from './api'

export interface VehicleComboboxProps {
  value: Vehicle | null
  onChange: (vehicle: Vehicle | null) => void
  label?: string
  required?: boolean
  error?: string
  id?: string
}

/** Autocompletar de veículos por placa, marca, modelo ou nome do cliente. */
export function VehicleCombobox({ value, onChange, label = 'Veículo', required, error, id }: VehicleComboboxProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    if (query === debounced) return
    const timer = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(timer)
  }, [query, debounced])

  const search = useVehicles({ page: 1, size: 8, q: debounced.trim() })
  const loading = query.trim() !== debounced.trim() || (search.isFetching && !search.data) || search.isPlaceholderData

  return (
    <Combobox<Vehicle>
      id={id}
      label={label}
      required={required}
      error={error}
      placeholder="Buscar por placa, marca ou modelo"
      clearLabel="Limpar veículo"
      value={value}
      onChange={onChange}
      options={search.data?.items ?? []}
      loading={loading}
      emptyMessage="Nenhum veículo encontrado"
      getKey={(vehicle) => vehicle.id}
      getText={(vehicle) => `${normalizePlate(vehicle.plate)} · ${vehicle.brand} ${vehicle.model}`}
      onQueryChange={setQuery}
      renderOption={(vehicle, { query: typed }) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold">
            <Highlight text={normalizePlate(vehicle.plate)} query={typed} />
          </span>
          <span className="block truncate text-legenda text-tinta-suave">
            {vehicle.brand} {vehicle.model} · {vehicle.year}
          </span>
        </span>
      )}
    />
  )
}
