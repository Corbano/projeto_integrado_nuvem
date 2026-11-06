const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const brlCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const integer = new Intl.NumberFormat('pt-BR')

/** "R$ 4.820" (sem centavos). Os espaços são normais para facilitar testes e leitura. */
export function formatBrl(value: number): string {
  return brl.format(value).replace(/\s/g, ' ')
}

/** "R$ 631,26". */
export function formatBrlCents(value: number): string {
  return brlCents.format(value).replace(/\s/g, ' ')
}

export function formatInt(value: number): string {
  return integer.format(value)
}
