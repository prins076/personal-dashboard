import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard'

type FetchMock = ReturnType<typeof vi.fn>

const originalFetch = globalThis.fetch
let fetchMock: FetchMock

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

type DashboardOverrides = {
  totals?: Partial<{
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number
  }>
  goals?: Partial<{
    calorie_goal: number | null
    protein_goal_g: number | null
    carbs_goal_g: number | null
    fat_goal_g: number | null
    water_goal_ml: number | null
  }>
  water?: Partial<{
    daily_total_ml: number
    water_goal_ml: number
    goal_percentage: number
  }>
  weight?: {
    latest: { id: number; date: string; weight_kg: number; notes: null; logged_at: string } | null
    change_from_previous: number | null
  }
  exercise?: Partial<{
    total_duration_min: number
    total_calories_burned: number
    entries: Array<{
      id: number
      name: string
      category: string
      duration_min: number | null
      calories_burned: number | null
    }>
  }>
  meals?: Partial<{
    breakfast: Array<{ id: number; food_name: string; quantity: number; unit: string; calories: number }>
    lunch: Array<{ id: number; food_name: string; quantity: number; unit: string; calories: number }>
    dinner: Array<{ id: number; food_name: string; quantity: number; unit: string; calories: number }>
    snack: Array<{ id: number; food_name: string; quantity: number; unit: string; calories: number }>
  }>
}

function dashboardResponse(overrides: DashboardOverrides = {}) {
  return {
    date: '2026-05-25',
    totals: {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      ...overrides.totals,
    },
    goals: {
      id: 1,
      calorie_goal: 2000,
      protein_goal_g: 150,
      carbs_goal_g: 200,
      fat_goal_g: 65,
      fiber_goal_g: 30,
      water_goal_ml: 2500,
      weight_goal_kg: null,
      updated_at: '2026-05-25 00:00:00',
      ...overrides.goals,
    },
    meals: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      ...overrides.meals,
    },
    water: {
      date: '2026-05-25',
      daily_total_ml: 0,
      water_goal_ml: 2500,
      goal_percentage: 0,
      ...overrides.water,
    },
    weight: overrides.weight ?? { latest: null, change_from_previous: null },
    exercise: {
      date: '2026-05-25',
      total_duration_min: 0,
      total_calories_burned: 0,
      entries: [],
      ...overrides.exercise,
    },
  }
}

describe('Dashboard page', () => {
  beforeEach(() => {
    fetchMock = vi.fn() as FetchMock
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('loads the day from a single /api/dashboard/today call on mount', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))

    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const dashCalls = fetchMock.mock.calls.filter(([url]) =>
      urlFor(url).startsWith('/api/dashboard/today'),
    )
    expect(dashCalls.length).toBe(1)
    // No second mount fetch to /api/water / /api/exercise / /api/weight — dashboard provides it all.
    expect(
      fetchMock.mock.calls.find(([url]) => urlFor(url) === '/api/water'),
    ).toBeUndefined()
    expect(
      fetchMock.mock.calls.find(([url]) => urlFor(url).startsWith('/api/exercise')),
    ).toBeUndefined()
    expect(
      fetchMock.mock.calls.find(([url]) => urlFor(url).startsWith('/api/weight')),
    ).toBeUndefined()
  })

  it('renders the calorie ring with percentage vs goal', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        dashboardResponse({
          totals: { calories: 500 },
          goals: { calorie_goal: 2000 },
        }),
      ),
    )

    render(<Dashboard />)

    const ring = await screen.findByTestId('calorie-ring')
    expect(within(ring).getByTestId('calorie-current')).toHaveTextContent(/500/)
    expect(within(ring).getByTestId('calorie-goal')).toHaveTextContent(/2000/)
    // 500/2000 = 25%
    expect(ring).toHaveAttribute('aria-valuenow', '25')
  })

  it('renders a pencil icon to edit the calorie goal', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))

    render(<Dashboard />)

    const ring = await screen.findByTestId('calorie-ring')
    expect(
      within(ring).getByRole('button', { name: /edit calorie goal/i }),
    ).toBeInTheDocument()
  })

  it('opens a popover pre-filled with the current goal when the pencil is clicked', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(dashboardResponse({ goals: { calorie_goal: 2000 } })),
    )

    const user = userEvent.setup()
    render(<Dashboard />)

    const ring = await screen.findByTestId('calorie-ring')
    await user.click(within(ring).getByRole('button', { name: /edit calorie goal/i }))

    const input = screen.getByRole('spinbutton', { name: /calorie goal/i })
    expect(input).toHaveValue(2000)
  })

  it('saves a new goal: PATCHes /api/goals, closes the popover, and updates the ring', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(dashboardResponse({ goals: { calorie_goal: 2000 } })),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 1,
          calorie_goal: 2500,
          protein_goal_g: 150,
          carbs_goal_g: 200,
          fat_goal_g: 65,
          fiber_goal_g: 30,
          water_goal_ml: 2500,
          weight_goal_kg: null,
          updated_at: '2026-05-26 10:00:00',
        }),
      )

    const user = userEvent.setup()
    render(<Dashboard />)

    const ring = await screen.findByTestId('calorie-ring')
    await user.click(within(ring).getByRole('button', { name: /edit calorie goal/i }))

    const input = screen.getByRole('spinbutton', { name: /calorie goal/i })
    await user.clear(input)
    await user.type(input, '2500')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // PATCH /api/goals with the new calorie_goal
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          urlFor(url) === '/api/goals' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      )
      expect(patchCall).toBeDefined()
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({
        calorie_goal: 2500,
      })
    })

    // Popover closed
    await waitFor(() => {
      expect(screen.queryByRole('spinbutton', { name: /calorie goal/i })).not.toBeInTheDocument()
    })

    // Ring reflects the new goal — no reload
    expect(within(ring).getByTestId('calorie-goal')).toHaveTextContent(/2500/)
    const dashCalls = fetchMock.mock.calls.filter(([url]) =>
      urlFor(url).startsWith('/api/dashboard/today'),
    )
    expect(dashCalls.length).toBe(1)
  })

  it('submits the goal when Enter is pressed in the input', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(dashboardResponse({ goals: { calorie_goal: 2000 } })),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          dashboardResponse({ goals: { calorie_goal: 1800 } }).goals,
        ),
      )

    const user = userEvent.setup()
    render(<Dashboard />)

    const ring = await screen.findByTestId('calorie-ring')
    await user.click(within(ring).getByRole('button', { name: /edit calorie goal/i }))

    const input = screen.getByRole('spinbutton', { name: /calorie goal/i })
    await user.clear(input)
    await user.type(input, '1800{Enter}')

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          urlFor(url) === '/api/goals' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      )
      expect(patchCall).toBeDefined()
    })
    expect(within(ring).getByTestId('calorie-goal')).toHaveTextContent(/1800/)
  })

  it('closes the popover without saving when Escape is pressed', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(dashboardResponse({ goals: { calorie_goal: 2000 } })),
    )

    const user = userEvent.setup()
    render(<Dashboard />)

    const ring = await screen.findByTestId('calorie-ring')
    await user.click(within(ring).getByRole('button', { name: /edit calorie goal/i }))
    expect(screen.getByRole('spinbutton', { name: /calorie goal/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('spinbutton', { name: /calorie goal/i })).not.toBeInTheDocument()
    })
    // No PATCH happened
    expect(
      fetchMock.mock.calls.find(
        ([url, init]) =>
          urlFor(url) === '/api/goals' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      ),
    ).toBeUndefined()
  })

  it('closes the popover without saving when clicking outside', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(dashboardResponse({ goals: { calorie_goal: 2000 } })),
    )

    const user = userEvent.setup()
    render(<Dashboard />)

    const ring = await screen.findByTestId('calorie-ring')
    await user.click(within(ring).getByRole('button', { name: /edit calorie goal/i }))
    expect(screen.getByRole('spinbutton', { name: /calorie goal/i })).toBeInTheDocument()

    await user.click(screen.getByRole('heading', { name: /dashboard/i }))

    await waitFor(() => {
      expect(screen.queryByRole('spinbutton', { name: /calorie goal/i })).not.toBeInTheDocument()
    })
    expect(
      fetchMock.mock.calls.find(
        ([url, init]) =>
          urlFor(url) === '/api/goals' &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      ),
    ).toBeUndefined()
  })

  it('renders the macro pie chart with one slice per macro', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        dashboardResponse({
          totals: { protein_g: 30, carbs_g: 60, fat_g: 10 },
        }),
      ),
    )

    render(<Dashboard />)

    const chart = await screen.findByTestId('macro-pie')
    expect(within(chart).getByText(/protein/i)).toBeInTheDocument()
    expect(within(chart).getByText(/carbs/i)).toBeInTheDocument()
    expect(within(chart).getByText(/fat/i)).toBeInTheDocument()
  })

  it('renders the water bar from the dashboard payload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        dashboardResponse({
          water: { daily_total_ml: 1250, water_goal_ml: 2500, goal_percentage: 50 },
        }),
      ),
    )

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByTestId('water-total')).toHaveTextContent(/1250/)
    })
    expect(screen.getByTestId('water-goal')).toHaveTextContent(/2500/)
    expect(screen.getByTestId('water-progress-bar-fill').style.width).toBe('50%')
  })

  it('clicking a water quick-add re-fetches the dashboard', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            entry: {
              id: 1,
              date: '2026-05-25',
              amount_ml: 250,
              notes: null,
              logged_at: '2026-05-25 09:00:00',
            },
            daily_total_ml: 250,
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          dashboardResponse({
            water: { daily_total_ml: 250, water_goal_ml: 2500, goal_percentage: 10 },
          }),
        ),
      )

    const user = userEvent.setup()
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByTestId('water-total')).toHaveTextContent(/0/)
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+250\s*ml/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('water-total')).toHaveTextContent(/250/)
    })

    // POST to /api/water happened
    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        urlFor(url) === '/api/water' && (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(postCall).toBeDefined()
    // And the dashboard was re-fetched (so the bar reflects the persisted total)
    const dashCalls = fetchMock.mock.calls.filter(([url]) =>
      urlFor(url).startsWith('/api/dashboard/today'),
    )
    expect(dashCalls.length).toBe(2)
  })

  it('renders today meals grouped by meal type', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        dashboardResponse({
          meals: {
            breakfast: [
              { id: 1, food_name: 'Oats', quantity: 100, unit: 'g', calories: 389 },
            ],
            lunch: [
              { id: 2, food_name: 'Chicken', quantity: 150, unit: 'g', calories: 247 },
            ],
          },
        }),
      ),
    )

    render(<Dashboard />)

    const breakfast = await screen.findByTestId('dash-meals-breakfast')
    expect(within(breakfast).getByText('Oats')).toBeInTheDocument()
    const lunch = screen.getByTestId('dash-meals-lunch')
    expect(within(lunch).getByText('Chicken')).toBeInTheDocument()
  })

  it('renders the weight widget with latest + delta from previous', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        dashboardResponse({
          weight: {
            latest: {
              id: 5,
              date: '2026-05-25',
              weight_kg: 79.2,
              notes: null,
              logged_at: '2026-05-25 07:00:00',
            },
            change_from_previous: -0.3,
          },
        }),
      ),
    )

    render(<Dashboard />)

    const widget = await screen.findByTestId('weight-widget')
    expect(within(widget).getByText(/79\.2/)).toBeInTheDocument()
    expect(within(widget).getByText(/-0\.3/)).toBeInTheDocument()
  })

  it('renders the exercise summary listing today entries', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        dashboardResponse({
          exercise: {
            total_duration_min: 45,
            total_calories_burned: 400,
            entries: [
              {
                id: 1,
                name: 'Running',
                category: 'cardio',
                duration_min: 30,
                calories_burned: 300,
              },
              {
                id: 2,
                name: 'Push-ups',
                category: 'strength',
                duration_min: 15,
                calories_burned: 100,
              },
            ],
          },
        }),
      ),
    )

    render(<Dashboard />)

    const widget = await screen.findByTestId('exercise-summary')
    expect(within(widget).getByText('Running')).toBeInTheDocument()
    expect(within(widget).getByText('Push-ups')).toBeInTheDocument()
    // Total duration shown
    expect(within(widget).getByText(/45/)).toBeInTheDocument()
  })

  describe('FAB (floating action button)', () => {
    it('renders the FAB button on the Dashboard', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      render(<Dashboard />)
      expect(screen.getByRole('button', { name: /add entry/i })).toBeInTheDocument()
    })

    it('clicking the FAB opens a submenu with four entry options', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))

      expect(screen.getByRole('button', { name: /^nutrition$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^water$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^exercise$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^weight$/i })).toBeInTheDocument()
    })

    it('clicking the FAB again closes the submenu', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      expect(screen.getByRole('button', { name: /^nutrition$/i })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      expect(screen.queryByRole('button', { name: /^nutrition$/i })).not.toBeInTheDocument()
    })

    it('clicking outside the submenu closes it', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      expect(screen.getByRole('button', { name: /^nutrition$/i })).toBeInTheDocument()

      await user.click(screen.getByTestId('fab-backdrop'))
      expect(screen.queryByRole('button', { name: /^nutrition$/i })).not.toBeInTheDocument()
    })
  })

  describe('Weight entry modal', () => {
    async function openWeightModal(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^weight$/i }))
    }

    it('selecting Weight from the FAB opens the weight entry modal', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await openWeightModal(user)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/weight.*kg/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    })

    it('cancel button closes the weight modal', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await openWeightModal(user)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('successful submit closes the modal and refreshes the dashboard', async () => {
      const weightEntry = { id: 1, date: '2026-05-29', weight_kg: 78.5, notes: null, logged_at: '2026-05-29 10:00:00' }
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(weightEntry), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      )
      fetchMock.mockResolvedValueOnce(
        jsonResponse(dashboardResponse({ weight: { latest: weightEntry, change_from_previous: null } })),
      )

      const user = userEvent.setup()
      render(<Dashboard />)

      await openWeightModal(user)
      await user.type(screen.getByLabelText(/weight.*kg/i), '78.5')
      await user.click(screen.getByRole('button', { name: /^save$/i }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      const postCalls = fetchMock.mock.calls.filter(
        ([url, init]) => urlFor(url) === '/api/weight' && (init as RequestInit)?.method === 'POST',
      )
      expect(postCalls.length).toBe(1)
    })

    it('409 conflict shows message directing user to History', async () => {
      const existing = { id: 1, date: '2026-05-29', weight_kg: 80.0, notes: null, logged_at: null }
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'DATE_ALREADY_LOGGED', existing }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )

      const user = userEvent.setup()
      render(<Dashboard />)

      await openWeightModal(user)
      await user.type(screen.getByLabelText(/weight.*kg/i), '79')
      await user.click(screen.getByRole('button', { name: /^save$/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/weight already logged/i)
      expect(screen.getByRole('alert')).toHaveTextContent(/history/i)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('FAB Nutrition modal', () => {
    it('selecting Nutrition from FAB opens the food entry modal', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^nutrition$/i }))

      expect(await screen.findByRole('heading', { name: /add food/i })).toBeInTheDocument()
    })

    it('Nutrition modal closes when the X button is clicked', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^nutrition$/i }))
      expect(await screen.findByRole('heading', { name: /add food/i })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /close modal/i }))
      expect(screen.queryByRole('heading', { name: /add food/i })).not.toBeInTheDocument()
    })
  })

  describe('FAB Exercise modal', () => {
    it('selecting Exercise from FAB opens the exercise entry modal', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^exercise$/i }))

      expect(await screen.findByRole('heading', { name: /add exercise/i })).toBeInTheDocument()
    })

    it('Exercise modal closes when cancel is clicked', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^exercise$/i }))
      expect(await screen.findByRole('heading', { name: /add exercise/i })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(screen.queryByRole('heading', { name: /add exercise/i })).not.toBeInTheDocument()
    })
  })

  describe('FAB Water popover', () => {
    it('selecting Water from FAB shows quick-add water buttons', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^water$/i }))

      const popover = screen.getByTestId('water-quick-add-popover')
      expect(within(popover).getByRole('button', { name: /\+150ml/i })).toBeInTheDocument()
      expect(within(popover).getByRole('button', { name: /\+250ml/i })).toBeInTheDocument()
      expect(within(popover).getByRole('button', { name: /\+500ml/i })).toBeInTheDocument()
    })

    it('clicking a water quick-add button closes the popover and logs water', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ entry: { id: 1, date: '2026-05-29', amount_ml: 250, notes: null, logged_at: null }, daily_total_ml: 250 }),
      )
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))

      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^water$/i }))

      const popover = screen.getByTestId('water-quick-add-popover')
      await user.click(within(popover).getByRole('button', { name: /\+250ml/i }))

      await waitFor(() => expect(screen.queryByTestId('water-quick-add-popover')).not.toBeInTheDocument())

      const waterCalls = fetchMock.mock.calls.filter(
        ([url, init]) => urlFor(url) === '/api/water' && (init as RequestInit)?.method === 'POST',
      )
      expect(waterCalls.length).toBe(1)
    })

    it('clicking outside the water popover closes it', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(dashboardResponse()))
      const user = userEvent.setup()
      render(<Dashboard />)

      await user.click(screen.getByRole('button', { name: /add entry/i }))
      await user.click(screen.getByRole('button', { name: /^water$/i }))
      expect(screen.getByTestId('water-quick-add-popover')).toBeInTheDocument()

      await user.click(screen.getByTestId('water-popover-backdrop'))
      expect(screen.queryByTestId('water-quick-add-popover')).not.toBeInTheDocument()
    })
  })
})
