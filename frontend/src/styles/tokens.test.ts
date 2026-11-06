import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf-8')

const colors: Record<string, string> = {
  navy: '#10194A',
  'navy-2': '#1B2766',
  azul: '#2457E6',
  'azul-escuro': '#1B45BD',
  menta: '#14C9A4',
  fundo: '#F4F6FB',
  superficie: '#FFFFFF',
  tinta: '#141B34',
  'tinta-suave': '#5A6482',
  linha: '#E3E7F1',
  'borda-campo': '#8892AF',
  ok: '#1FA971',
  'ok-texto': '#13744D',
  'ok-fundo': '#E3F6EE',
  atencao: '#F2A20C',
  'atencao-texto': '#8A5A00',
  'atencao-fundo': '#FFF3D6',
  critico: '#E5484D',
  'critico-texto': '#B3262B',
  'critico-fundo': '#FDE8E9',
  'info-fundo': '#E8EEFF',
  'acento-azul': '#2457E6',
  'acento-menta': '#14C9A4',
  'acento-violeta': '#6B3FE0',
  'acento-ciano': '#0E8FB0',
  'acento-laranja': '#F2711C',
  'acento-rosa': '#D9468F',
  'coluna-azul': '#EAF0FF',
  'coluna-verde': '#E5F6EE',
  'coluna-laranja': '#FFF0E1',
  'coluna-cinza': '#EEF0F6',
}

const texts: Record<string, [string, string]> = {
  legenda: ['12px', '1.4'],
  mini: ['13px', '1.45'],
  corpo: ['14px', '1.55'],
  destaque: ['15px', '1.55'],
  card: ['18px', '1.35'],
  secao: ['22px', '1.3'],
  titulo: ['28px', '1.2'],
  kpi: ['34px', '1'],
  marca: ['40px', '1.12'],
}

const radii: Record<string, string> = {
  placa: '6px',
  controle: '10px',
  card: '16px',
  dialogo: '20px',
  pilula: '9999px',
}

function token(name: string): string | undefined {
  return css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
}

function hex(name: string): string {
  const v = token(`color-${name}`)
  if (!v || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`token --color-${name} ausente ou inválido`)
  return v
}

function luminance(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('tokens.css', () => {
  it.each(Object.entries(colors))('define --color-%s como %s', (name, expected) => {
    expect(hex(name).toUpperCase()).toBe(expected)
  })

  it('não mantém os tokens da paleta antiga', () => {
    for (const old of ['concreto', 'bancada', 'chassi', 'esmalte', 'oleo', 'freio', 'sinal', 'risco']) {
      expect(css).not.toMatch(new RegExp(`--color-${old}\\b`))
    }
  })

  it('usa Inter como fonte de texto e Barlow Condensed como display', () => {
    expect(token('font-sans')).toMatch(/^"Inter Variable"/)
    expect(token('font-display')).toMatch(/^"Barlow Condensed"/)
    expect(css).toMatch(/inter-latin-wght-normal\.woff2/)
    expect(css).toMatch(/inter-latin-ext-wght-normal\.woff2/)
    expect(css).not.toMatch(/ibm-plex/)
  })

  it.each(Object.entries(texts))('define --text-%s', (name, [size, lh]) => {
    expect(token(`text-${name}`)).toBe(size)
    expect(token(`text-${name}--line-height`)).toBe(lh)
  })

  it.each(Object.entries(radii))('define --radius-%s como %s', (name, value) => {
    expect(token(`radius-${name}`)).toBe(value)
  })

  it('define as sombras de card e diálogo', () => {
    expect(token('shadow-card')).toBe('0 1px 2px rgba(16, 25, 74, 0.06), 0 8px 24px rgba(16, 25, 74, 0.06)')
    expect(token('shadow-dialogo')).toBeDefined()
  })

  it('não redefine utilitários padrão do Tailwind', () => {
    for (const d of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']) {
      expect(css).not.toMatch(new RegExp(`--text-${d}\\s*:`))
    }
  })
})

describe('contraste WCAG AA', () => {
  const text = (fg: string, bg: string) => ratio(hex(fg), hex(bg))

  it.each([
    ['tinta', 'superficie'],
    ['tinta', 'fundo'],
    ['tinta-suave', 'superficie'],
    ['tinta-suave', 'fundo'],
    ['tinta-suave', 'coluna-cinza'],
    ['azul', 'superficie'],
    ['azul', 'fundo'],
    ['azul', 'info-fundo'],
    ['ok-texto', 'ok-fundo'],
    ['ok-texto', 'superficie'],
    ['atencao-texto', 'atencao-fundo'],
    ['atencao-texto', 'superficie'],
    ['critico-texto', 'critico-fundo'],
    ['critico-texto', 'superficie'],
    ['navy', 'menta'],
  ])('%s sobre %s >= 4.5', (fg, bg) => {
    expect(text(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['azul', 'azul-escuro', 'navy', 'navy-2', 'critico-texto'])('branco sobre %s >= 4.5', (bg) => {
    expect(ratio('#FFFFFF', hex(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it('borda-campo sobre superficie >= 3', () => {
    expect(text('borda-campo', 'superficie')).toBeGreaterThanOrEqual(3)
  })

  it.each(['superficie', 'fundo'])('anel de foco azul sobre %s >= 3', (bg) => {
    expect(text('azul', bg)).toBeGreaterThanOrEqual(3)
  })
})
