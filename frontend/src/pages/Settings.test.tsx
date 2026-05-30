import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from './Settings'

type FetchMock = ReturnType<typeof vi.fn>

const originalFetch = globalThis.fetch

const defaultGoals = {
  id: 1,
  calorie_goal: 2000,
  protein_goal_g: 150,
  carbs_goal_g: 200,
  fat_goal_g: 65,
  fiber_goal_g: 30,
  water_goal_ml: 2500,
  weight_goal_kg: null,
  updated_at: '2026-05-25 12:00:00',
}

const defaultProfile = {
  id: 1,
  age: null,
  sex: null,
  height_cm: null,
  activity_level: null,
  updated_at: '2026-05-25 12:00:00',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Settings page', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockImplementation((input: unknown) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      return Promise.reject(new Error(`unexpected ${url}`))
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders the settings heading, goals form, and calculator', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument()
    expect(screen.getByText(/nutritional goals/i)).toBeInTheDocument()
    expect(screen.getByText(/calorie calculator/i)).toBeInTheDocument()

    expect(await screen.findByLabelText(/calorie goal/i)).toHaveValue(2000)
  })

  it('renders profile calculator fields', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/^sex$/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/^age/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^height/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^activity level/i)).toBeInTheDocument()
  })
})
