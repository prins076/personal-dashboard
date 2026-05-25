import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it('renders Dashboard page at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders Nutrition page at /nutrition', () => {
    renderAt('/nutrition')
    expect(screen.getByRole('heading', { name: /nutrition/i })).toBeInTheDocument()
  })

  it('renders Exercise page at /exercise', () => {
    renderAt('/exercise')
    expect(screen.getByRole('heading', { name: /exercise/i })).toBeInTheDocument()
  })

  it('renders Progress page at /progress', () => {
    renderAt('/progress')
    expect(screen.getByRole('heading', { name: /progress/i })).toBeInTheDocument()
  })

  it('renders History page at /history', () => {
    renderAt('/history')
    expect(screen.getByRole('heading', { name: /history/i })).toBeInTheDocument()
  })
})
