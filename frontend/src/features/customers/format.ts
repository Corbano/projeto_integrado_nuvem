/** Máscaras e validação de CPF/CNPJ e telefone (mesmo algoritmo do backend, app/domain/document.py). */

export type DocumentType = 'CPF' | 'CNPJ'

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Aplica um molde ("###.###.###-##") aos dígitos, parando quando os dígitos acabam. */
function applyMask(digits: string, pattern: string): string {
  let out = ''
  let index = 0
  for (const char of pattern) {
    if (index >= digits.length) break
    if (char === '#') out += digits[index++]
    else out += char
  }
  return out
}

/** CPF (até 11 dígitos) ou CNPJ (12 a 14), com a máscara aplicada progressivamente enquanto se digita. */
export function formatDocument(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)
  return digits.length <= 11 ? applyMask(digits, '###.###.###-##') : applyMask(digits, '##.###.###/####-##')
}

/** 11 dígitos ou menos = CPF; mais que isso = CNPJ. */
export function documentType(value: string): DocumentType {
  return onlyDigits(value).length > 11 ? 'CNPJ' : 'CPF'
}

function checkDigit(digits: string, weights: number[]): number {
  const total = weights.reduce((sum, weight, index) => sum + Number(digits[index]) * weight, 0)
  const rest = total % 11
  return rest < 2 ? 0 : 11 - rest
}

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_W2 = [6, ...CNPJ_W1]

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value)
  if (digits.length !== 11 || new Set(digits).size === 1) return false
  const first = checkDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checkDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return digits.slice(9) === `${first}${second}`
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value)
  if (digits.length !== 14 || new Set(digits).size === 1) return false
  const first = checkDigit(digits.slice(0, 12), CNPJ_W1)
  const second = checkDigit(digits.slice(0, 13), CNPJ_W2)
  return digits.slice(12) === `${first}${second}`
}

export function isValidDocument(value: string): boolean {
  return isValidCpf(value) || isValidCnpj(value)
}

/** Mensagem de erro para o campo, ou null quando o documento é válido. */
export function validateDocument(value: string): string | null {
  const digits = onlyDigits(value)
  if (!digits) return 'Informe o CPF ou o CNPJ.'
  if (digits.length !== 11 && digits.length !== 14) {
    return 'Documento incompleto: o CPF tem 11 dígitos e o CNPJ tem 14.'
  }
  if (digits.length === 11) return isValidCpf(digits) ? null : 'CPF inválido. Confira os números digitados.'
  return isValidCnpj(digits) ? null : 'CNPJ inválido. Confira os números digitados.'
}

/** Telefone com DDD: (11) 2345-6789 (10 dígitos) ou (11) 91234-5678 (11 dígitos), progressivo. */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Vazio é permitido (campo opcional). */
export function validatePhone(value: string): string | null {
  const digits = onlyDigits(value)
  if (!digits) return null
  return digits.length === 10 || digits.length === 11
    ? null
    : 'Telefone deve ter 10 ou 11 dígitos, com DDD.'
}
