import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './useTheme'

function Toggler() {
  const { theme, toggleTheme } = useTheme()
  return <button data-testid="toggler" onClick={toggleTheme}>{theme}</button>
}

function Display() {
  const { theme } = useTheme()
  return <span data-testid="display">{theme}</span>
}

describe('ThemeProvider shared state', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.classList.remove('dark')
  })

  it('toggling theme in one consumer updates all consumers under the same provider', () => {
    render(
      <ThemeProvider>
        <Toggler />
        <Display />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('display').textContent).toBe('light')
    expect(screen.getByTestId('toggler').textContent).toBe('light')

    act(() => {
      screen.getByTestId('toggler').click()
    })

    expect(screen.getByTestId('display').textContent).toBe('dark')
    expect(screen.getByTestId('toggler').textContent).toBe('dark')
  })
})
