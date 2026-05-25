import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderProgress() {
  return render(
    <MemoryRouter>
      <Progress />
    </MemoryRouter>,
  )
}

function urlFor(input: unknown): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return String(input)
}

describe('Progress page goals editor', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches goals on mount and renders them in inputs', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    renderProgress()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/goals', expect.objectContaining({ method: 'GET' }))
    })

    expect(await screen.findByLabelText(/calorie goal/i)).toHaveValue(2000)
    expect(screen.getByLabelText(/protein/i)).toHaveValue(150)
    expect(screen.getByLabelText(/carbs/i)).toHaveValue(200)
    expect(screen.getByLabelText(/^fat/i)).toHaveValue(65)
    expect(screen.getByLabelText(/fiber/i)).toHaveValue(30)
    expect(screen.getByLabelText(/water/i)).toHaveValue(2500)
    expect(screen.getByLabelText(/target weight/i)).toHaveValue(null)
  })

  it('saves edited goals via PATCH and reflects the new values without reload', async () => {
    let patchResponse = {
      ...defaultGoals,
      calorie_goal: 2200,
      protein_goal_g: 180,
      weight_goal_kg: 75.5,
      updated_at: '2026-05-25 13:00:00',
    }

    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const url = urlFor(input)
      if (url === '/api/goals' && (!init || init.method === 'GET' || !init.method)) {
        return Promise.resolve(jsonResponse(defaultGoals))
      }
      if (url === '/api/goals' && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(patchResponse))
      }
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    const user = userEvent.setup()
    renderProgress()

    const calorieInput = await screen.findByLabelText(/calorie goal/i)
    const proteinInput = screen.getByLabelText(/protein/i)
    const weightInput = screen.getByLabelText(/target weight/i)

    await user.clear(calorieInput)
    await user.type(calorieInput, '2200')
    await user.clear(proteinInput)
    await user.type(proteinInput, '180')
    await user.type(weightInput, '75.5')

    await user.click(screen.getByRole('button', { name: /save/i }))

    const patchCall = await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/goals' && (init as RequestInit | undefined)?.method === 'PATCH',
      )
      expect(call).toBeDefined()
      return call as [string, RequestInit]
    })

    const body = JSON.parse(patchCall[1].body as string)
    expect(body).toMatchObject({
      calorie_goal: 2200,
      protein_goal_g: 180,
      weight_goal_kg: 75.5,
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/calorie goal/i)).toHaveValue(2200)
    })
    expect(screen.getByLabelText(/target weight/i)).toHaveValue(75.5)
    void patchResponse
  })
})

describe('Progress page — 30-day weight chart', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches weight entries from /api/weight?days=30 and renders the chart', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) {
        return Promise.resolve(
          jsonResponse([
            { id: 1, date: '2026-05-22', weight_kg: 80.0, change_from_previous: null },
            { id: 2, date: '2026-05-23', weight_kg: 79.5, change_from_previous: -0.5 },
            { id: 3, date: '2026-05-25', weight_kg: 78.2, change_from_previous: -1.3 },
          ]),
        )
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const weightCall = fetchMock.mock.calls.find(([url]) => urlFor(url).startsWith('/api/weight'))
      expect(weightCall).toBeDefined()
      expect(urlFor(weightCall![0])).toBe('/api/weight?days=30')
    })

    await waitFor(() => {
      expect(screen.getByTestId('weight-chart')).toBeInTheDocument()
    })
  })

  it('renders an empty state when no entries are returned', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/no weight entries/i)).toBeInTheDocument()
    })
  })
})
