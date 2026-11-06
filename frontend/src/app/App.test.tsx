import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('mostra a marca do produto', () => {
    render(<App />)
    expect(screen.getByText('Auto Center')).toBeInTheDocument()
  })
})
