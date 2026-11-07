import { describe, expect, it } from 'vitest'
import {
  documentType,
  formatDocument,
  formatPhone,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  onlyDigits,
  validateDocument,
  validatePhone,
} from './format'

// CPF e CNPJ de teste com dígitos verificadores corretos (números fictícios de exemplo).
const CPF = '52998224725'
const CNPJ = '11222333000181'

describe('máscara de documento', () => {
  it('aplica a máscara de CPF progressivamente', () => {
    expect(formatDocument('5')).toBe('5')
    expect(formatDocument('5299')).toBe('529.9')
    expect(formatDocument('529982247')).toBe('529.982.247')
    expect(formatDocument('5299822472')).toBe('529.982.247-2')
    expect(formatDocument(CPF)).toBe('529.982.247-25')
  })

  it('passa para a máscara de CNPJ a partir do 12º dígito', () => {
    expect(formatDocument('529982247251')).toBe('52.998.224/7251')
    expect(formatDocument(CNPJ)).toBe('11.222.333/0001-81')
  })

  it('aceita texto já mascarado, ignora letras e corta em 14 dígitos', () => {
    expect(formatDocument('529.982.247-25')).toBe('529.982.247-25')
    expect(formatDocument('abc')).toBe('')
    expect(formatDocument('112223330001819999')).toBe('11.222.333/0001-81')
  })

  it('onlyDigits remove a máscara', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe(CNPJ)
  })

  it('detecta o tipo pela quantidade de dígitos', () => {
    expect(documentType('')).toBe('CPF')
    expect(documentType(CPF)).toBe('CPF')
    expect(documentType('529982247251')).toBe('CNPJ')
    expect(documentType('11.222.333/0001-81')).toBe('CNPJ')
  })
})

describe('validação de documento', () => {
  it('valida CPF com dígitos verificadores', () => {
    expect(isValidCpf(CPF)).toBe(true)
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224726')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })

  it('valida CNPJ com dígitos verificadores', () => {
    expect(isValidCnpj(CNPJ)).toBe(true)
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000182')).toBe(false)
    expect(isValidCnpj('00000000000000')).toBe(false)
  })

  it('isValidDocument aceita CPF ou CNPJ', () => {
    expect(isValidDocument(CPF)).toBe(true)
    expect(isValidDocument(CNPJ)).toBe(true)
    expect(isValidDocument('12345678900')).toBe(false)
  })

  it('devolve mensagens claras para o campo', () => {
    expect(validateDocument('')).toBe('Informe o CPF ou o CNPJ.')
    expect(validateDocument('123.456')).toMatch(/incompleto/)
    expect(validateDocument('123.456.789-00')).toBe('CPF inválido. Confira os números digitados.')
    expect(validateDocument('11.222.333/0001-82')).toBe('CNPJ inválido. Confira os números digitados.')
    expect(validateDocument(CPF)).toBeNull()
    expect(validateDocument(CNPJ)).toBeNull()
  })
})

describe('telefone', () => {
  it('formata 10 e 11 dígitos', () => {
    expect(formatPhone('1')).toBe('(1')
    expect(formatPhone('119')).toBe('(11) 9')
    expect(formatPhone('1123456789')).toBe('(11) 2345-6789')
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678')
    expect(formatPhone('(11) 91234-5678999')).toBe('(11) 91234-5678')
    expect(formatPhone('')).toBe('')
  })

  it('valida 10 ou 11 dígitos; vazio é permitido', () => {
    expect(validatePhone('')).toBeNull()
    expect(validatePhone('(11) 2345-6789')).toBeNull()
    expect(validatePhone('(11) 91234-5678')).toBeNull()
    expect(validatePhone('(11) 9123-567')).toBe('Telefone deve ter 10 ou 11 dígitos, com DDD.')
  })
})
