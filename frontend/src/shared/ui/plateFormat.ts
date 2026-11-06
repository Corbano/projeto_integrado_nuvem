const OLD_RE = /^[A-Z]{3}\d{4}$/
const MERCOSUL_RE = /^[A-Z]{3}\d[A-Z]\d{2}$/

/**
 * Normaliza uma placa: maiusculas, sem separadores. Formato antigo ganha hifen
 * (ABC-1234), Mercosul fica junto (ABC1D23). Entrada invalida volta so limpa
 * (maiusculas, sem separadores), sem lancar erro.
 */
export function normalizePlate(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (OLD_RE.test(clean)) return `${clean.slice(0, 3)}-${clean.slice(3)}`
  return clean
}

export function isValidPlate(raw: string): boolean {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return OLD_RE.test(clean) || MERCOSUL_RE.test(clean)
}
