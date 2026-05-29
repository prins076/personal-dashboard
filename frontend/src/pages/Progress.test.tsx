import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Progress from './Progress'

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

function urlFor(input: unknown): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return String(input)
}

describe('Progress page — coordinator smoke tests', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders without crashing and mounts all four child modules', async () => {
    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/calorie goal/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/weight — last 30 days/i)).toBeInTheDocument()
    expect(screen.getByText(/calories — this week/i)).toBeInTheDocument()
    expect(screen.getByText(/nutritional goals/i)).toBeInTheDocument()
    expect(screen.getByText(/calorie calculator/i)).toBeInTheDocument()
  })
})
