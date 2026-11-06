import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf-8')

const colors: Record<string, string> = {
  concreto: '#E7EAEB',
  bancada: '#F8F9F9',
  chassi: '#15262D',
  esmalte: '#0E5A6B',
  oleo: '#D68A00',
  freio: '#BF3B2D',
  sinal: '#2E7A4D',
  risco: '#C9D0D2',
}

const texts: Record<string, [string, string]> = {
  mini: ['13px', '1.4'],
  corpo: ['15px', '1.5'],
  destaque: ['17px', '1.45'],
  secao: ['22px', '1.2'],
  titulo: ['30px', '1.1'],
  marca: ['44px', '1'],
}

function token(name: string): string | undefined {
  return css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
}

function hex(name: string): string {
  const v = token(`color-${name}`)
  if (!v || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`token --color-${name} ausente ou invalido`)
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

  it('define as familias de fonte', () => {
    expect(token('font-display')).toBeDefined()
    expect(token('font-sans')).toBeDefined()
  })

  it.each(Object.entries(texts))('define --text-%s', (name, [size, lh]) => {
    expect(token(`text-${name}`)).toBe(size)
    expect(token(`text-${name}--line-height`)).toBe(lh)
  })

  it('nao redefine utilitarios padrao do Tailwind', () => {
    for (const d of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']) {
      expect(css).not.toMatch(new RegExp(`--text-${d}\\s*:`))
    }
  })
})

describe('contraste WCAG AA', () => {
  const surfaces = ['concreto', 'bancada']

  it.each(['chassi', 'chassi-suave', 'esmalte', 'freio-texto', 'sinal-texto'].flatMap((fg) =>
    surfaces.map((bg) => [fg, bg]),
  ))('%s sobre %s >= 4.5', (fg, bg) => {
    expect(ratio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it('borda-campo sobre bancada >= 3', () => {
    expect(ratio(hex('borda-campo'), hex('bancada'))).toBeGreaterThanOrEqual(3)
  })

  it.each(['esmalte', 'freio', 'sinal'])('branco sobre %s >= 4.5', (bg) => {
    expect(ratio('#FFFFFF', hex(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it('chassi sobre oleo >= 4.5', () => {
    expect(ratio(hex('chassi'), hex('oleo'))).toBeGreaterThanOrEqual(4.5)
  })
})
