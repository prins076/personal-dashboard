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
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
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
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
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

    await user.click(screen.getByRole('button', { name: /^save$/i }))

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
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
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
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
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

describe('Progress page — calendar week calorie bar chart', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // Monday is past, Wed = "today" (2026-05-20), Thu..Sun = future
  const weekData = [
    { date: '2026-05-18', calories: 1800, protein_g: 100, carbs_g: 200, fat_g: 60 },
    { date: '2026-05-19', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    { date: '2026-05-20', calories: 1500, protein_g: 90, carbs_g: 180, fat_g: 50 },
    { date: '2026-05-21', calories: null, protein_g: null, carbs_g: null, fat_g: null },
    { date: '2026-05-22', calories: null, protein_g: null, carbs_g: null, fat_g: null },
    { date: '2026-05-23', calories: null, protein_g: null, carbs_g: null, fat_g: null },
    { date: '2026-05-24', calories: null, protein_g: null, carbs_g: null, fat_g: null },
  ]

  it('fetches /api/dashboard/week and renders the bar chart wrapper', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse(weekData))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const weekCall = fetchMock.mock.calls.find(([url]) => urlFor(url).startsWith('/api/dashboard/week'))
      expect(weekCall).toBeDefined()
      expect(urlFor(weekCall![0])).toBe('/api/dashboard/week')
    })

    await waitFor(() => {
      expect(screen.getByTestId('calorie-week-chart')).toBeInTheDocument()
    })
  })

  it('renders a day-state summary marking past vs future days', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse(weekData))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    )

    // The component exposes one summary row per day with data-day-state
    // so we can assert past/future split without poking Recharts SVG.
    await waitFor(() => {
      expect(screen.getByTestId('week-day-summary')).toBeInTheDocument()
    })

    const summary = screen.getByTestId('week-day-summary')
    expect(summary.querySelectorAll('[data-day-state="past"]').length).toBe(3)
    expect(summary.querySelectorAll('[data-day-state="future"]').length).toBe(4)

    // Mon-Sun in order
    const labels = Array.from(summary.querySelectorAll('[data-day-label]')).map(
      (el) => el.getAttribute('data-day-label'),
    )
    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('exposes the calorie goal value used for the reference line', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse(weekData))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    )

    const chart = await screen.findByTestId('calorie-week-chart')
    expect(chart.getAttribute('data-calorie-goal')).toBe('2000')
  })
})

describe('Progress page — Mifflin-St Jeor calorie calculator', () => {
  let fetchMock: FetchMock

  const defaultWeightEntries = [
    { id: 1, date: '2026-05-25', weight_kg: 75.0, change_from_previous: null },
  ]

  function mockAll(profileOverride: unknown = defaultProfile) {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse(defaultWeightEntries))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(profileOverride))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })
  }

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders all four calculator fields', async () => {
    mockAll()
    renderProgress()
    await screen.findByLabelText(/calorie goal/i) // wait for goals to load

    expect(screen.getByLabelText(/^sex$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^age/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^height/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^activity level/i)).toBeInTheDocument()
  })

  it('uses latest logged weight automatically and does not show weight input', async () => {
    mockAll()
    renderProgress()
    await screen.findByLabelText(/calorie goal/i)

    expect(screen.queryByLabelText(/^weight \(kg\)/i)).not.toBeInTheDocument()
    expect(screen.getByText(/using latest weight 75 kg/i)).toBeInTheDocument()
  })

  it('shows manual weight input when no weight entries exist', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    renderProgress()
    await screen.findByLabelText(/calorie goal/i)

    expect(screen.getByLabelText(/^weight \(kg\)/i)).toBeInTheDocument()
  })

  it('updates suggested kcal in real time as inputs change', async () => {
    mockAll()
    const user = userEvent.setup()
    renderProgress()
    await screen.findByLabelText(/calorie goal/i)

    const suggested = screen.getByTestId('suggested-kcal')
    expect(suggested).toHaveTextContent('—')

    await user.selectOptions(screen.getByLabelText(/^sex$/i), 'male')
    await user.clear(screen.getByLabelText(/^age/i))
    await user.type(screen.getByLabelText(/^age/i), '25')
    await user.clear(screen.getByLabelText(/^height/i))
    await user.type(screen.getByLabelText(/^height/i), '170')
    await user.selectOptions(screen.getByLabelText(/^activity level/i), 'sedentary')

    // male, 25y, 170cm, 75kg, sedentary → BMR = 10*75+6.25*170-5*25+5=750+1062.5-125+5=1692.5 → TDEE=round(1692.5*1.2)=2031
    expect(suggested).toHaveTextContent('2031 kcal')
  })

  it('pre-fills form from saved profile on load', async () => {
    const savedProfile = {
      id: 1,
      age: 30,
      sex: 'female',
      height_cm: 165,
      activity_level: 'lightly_active',
      updated_at: '2026-05-25 12:00:00',
    }
    mockAll(savedProfile)
    renderProgress()
    await screen.findByLabelText(/calorie goal/i)

    await waitFor(() => {
      expect(screen.getByLabelText(/^sex$/i)).toHaveValue('female')
    })
    expect(screen.getByLabelText(/^age/i)).toHaveValue(30)
    expect(screen.getByLabelText(/^height/i)).toHaveValue(165)
    expect(screen.getByLabelText(/^activity level/i)).toHaveValue('lightly_active')
  })

  it('saves profile via PATCH /api/profile', async () => {
    mockAll()
    const user = userEvent.setup()
    renderProgress()
    await screen.findByLabelText(/calorie goal/i)

    await user.selectOptions(screen.getByLabelText(/^sex$/i), 'male')
    await user.clear(screen.getByLabelText(/^age/i))
    await user.type(screen.getByLabelText(/^age/i), '28')
    await user.clear(screen.getByLabelText(/^height/i))
    await user.type(screen.getByLabelText(/^height/i), '178')
    await user.selectOptions(screen.getByLabelText(/^activity level/i), 'moderately_active')

    const updatedProfile = {
      id: 1, age: 28, sex: 'male', height_cm: 178, activity_level: 'moderately_active',
      updated_at: '2026-05-28 10:00:00',
    }
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const url = urlFor(input)
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse(defaultWeightEntries))
      if (url === '/api/profile' && init?.method === 'PATCH') return Promise.resolve(jsonResponse(updatedProfile))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    await user.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/profile' && (init as RequestInit)?.method === 'PATCH',
      )
      expect(patchCall).toBeDefined()
      const body = JSON.parse((patchCall![1] as RequestInit).body as string)
      expect(body).toMatchObject({ sex: 'male', age: 28, height_cm: 178, activity_level: 'moderately_active' })
    })
  })

  it('applies suggested kcal as calorie goal via PATCH /api/goals', async () => {
    mockAll()
    const user = userEvent.setup()
    renderProgress()
    await screen.findByLabelText(/calorie goal/i)

    await user.selectOptions(screen.getByLabelText(/^sex$/i), 'female')
    await user.clear(screen.getByLabelText(/^age/i))
    await user.type(screen.getByLabelText(/^age/i), '30')
    await user.clear(screen.getByLabelText(/^height/i))
    await user.type(screen.getByLabelText(/^height/i), '160')
    await user.selectOptions(screen.getByLabelText(/^activity level/i), 'sedentary')

    const updatedGoals = { ...defaultGoals, calorie_goal: 1698, updated_at: '2026-05-28 10:00:00' }
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const url = urlFor(input)
      if (url === '/api/goals' && init?.method === 'PATCH') return Promise.resolve(jsonResponse(updatedGoals))
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(defaultGoals))
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse(defaultWeightEntries))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(defaultProfile))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })

    await user.click(screen.getByRole('button', { name: /apply as goal/i }))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/goals' && (init as RequestInit)?.method === 'PATCH',
      )
      expect(patchCall).toBeDefined()
      const body = JSON.parse((patchCall![1] as RequestInit).body as string)
      // female, 30y, 160cm, 75kg, sedentary → BMR=10*75+6.25*160-5*30-161=750+1000-150-161=1439 → TDEE=round(1439*1.2)=1727
      expect(body).toMatchObject({ calorie_goal: expect.any(Number) })
    })
  })
})
