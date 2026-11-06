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

describe('tokens.css', () => {
  it.each(Object.entries(colors))('define --color-%s como %s', (name, hex) => {
    const re = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`)
    const match = css.match(re)
    expect(match, `token --color-${name} ausente`).not.toBeNull()
    expect(match![1].toUpperCase()).toBe(hex)
  })

  it('define as familias de fonte', () => {
    expect(css).toContain('--font-display:')
    expect(css).toContain('--font-sans:')
  })
})
