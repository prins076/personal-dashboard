import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import History from './History'

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

type HandlerKey = '/api/meals' | '/api/water' | '/api/exercise' | '/api/weight'
type Handlers = Partial<Record<HandlerKey, (url: string) => unknown>>

function mockFetch(handlers: Handlers) {
  const calls: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    for (const [prefix, handler] of Object.entries(handlers)) {
      if (url.startsWith(prefix)) {
        return jsonResponse(handler!(url))
      }
    }
    throw new Error(`Unhandled fetch: ${url}`)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return { fetchMock, calls }
}

function meal(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    logged_at: '2026-05-25 08:00:00',
    date: '2026-05-25',
    meal_type: 'breakfast',
    food_id: null,
    food_name: 'Oats',
    quantity: 100,
    unit: 'g',
    calories: 389,
    protein_g: 16.9,
    carbs_g: 66.3,
    fat_g: 6.9,
    fiber_g: 10.6,
    notes: null,
    ...overrides,
  }
}

function water(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    date: '2026-05-25',
    amount_ml: 500,
    notes: null,
    logged_at: '2026-05-25 09:00:00',
    ...overrides,
  }
}

function exercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    logged_at: '2026-05-25 18:00:00',
    date: '2026-05-25',
    name: 'Morning run',
    category: 'cardio',
    duration_min: 30,
    sets: null,
    reps: null,
    weight_kg: null,
    distance_km: 5,
    calories_burned: 320,
    notes: null,
    ...overrides,
  }
}

function weight(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    date: '2026-05-25',
    weight_kg: 78.2,
    notes: null,
    logged_at: '2026-05-25 07:00:00',
    change_from_previous: null,
    ...overrides,
  }
}

describe('History page', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders four tabs and loads the Meals tab by default', async () => {
    mockFetch({
      '/api/meals': () => [meal({ food_name: 'Oats' })],
      '/api/water': () => [],
      '/api/exercise': () => [],
      '/api/weight': () => [],
    })

    render(<History />)

    expect(screen.getByRole('tab', { name: /meals/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /water/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /exercise/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /weight/i })).toBeInTheDocument()

    // Meals tab is the default; the row appears
    expect(await screen.findByText('Oats')).toBeInTheDocument()
  })

  it('switches tabs and shows each category', async () => {
    mockFetch({
      '/api/meals': () => [meal({ food_name: 'Oats' })],
      '/api/water': () => [water({ amount_ml: 250 })],
      '/api/exercise': () => [exercise({ name: 'Squats' })],
      '/api/weight': () => [weight({ weight_kg: 80.5 })],
    })

    const user = userEvent.setup()
    render(<History />)

    expect(await screen.findByText('Oats')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /water/i }))
    expect(await screen.findByText('250')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /exercise/i }))
    expect(await screen.findByText('Squats')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /weight/i }))
    expect(await screen.findByText('80.5')).toBeInTheDocument()
  })

  it('passes start and end date params from the date filter to the API', async () => {
    const { calls } = mockFetch({
      '/api/meals': () => [],
      '/api/water': () => [],
      '/api/exercise': () => [],
      '/api/weight': () => [],
    })

    const user = userEvent.setup()
    render(<History />)

    const fromInput = screen.getByLabelText(/from/i)
    const toInput = screen.getByLabelText(/to/i)

    await user.clear(fromInput)
    await user.type(fromInput, '2026-04-01')
    await user.clear(toInput)
    await user.type(toInput, '2026-04-30')

    await waitFor(() => {
      const mealsCalls = calls.filter((c) => c.startsWith('/api/meals'))
      const last = mealsCalls[mealsCalls.length - 1]
      expect(last).toMatch(/start=2026-04-01/)
      expect(last).toMatch(/end=2026-04-30/)
    })
  })

  it('shows an empty state when no entries match the range', async () => {
    mockFetch({
      '/api/meals': () => [],
      '/api/water': () => [],
      '/api/exercise': () => [],
      '/api/weight': () => [],
    })

    render(<History />)

    expect(await screen.findByText(/no entries/i)).toBeInTheDocument()
  })

  it('paginates results with next/previous controls and correct count', async () => {
    // 25 entries → 2 pages at page size 20
    const meals = Array.from({ length: 25 }, (_, i) =>
      meal({ id: i + 1, food_name: `Meal ${i + 1}` }),
    )
    mockFetch({
      '/api/meals': () => meals,
      '/api/water': () => [],
      '/api/exercise': () => [],
      '/api/weight': () => [],
    })

    const user = userEvent.setup()
    render(<History />)

    expect(await screen.findByText('Meal 1')).toBeInTheDocument()
    // first page shows 20 rows
    const table = screen.getByRole('table')
    const firstPageRows = within(table).getAllByRole('row')
    // 20 data rows + 1 header
    expect(firstPageRows.length).toBe(21)
    expect(screen.queryByText('Meal 21')).not.toBeInTheDocument()

    // Page indicator visible
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText('Meal 21')).toBeInTheDocument()
    expect(screen.queryByText('Meal 1')).not.toBeInTheDocument()
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument()

    // Previous returns to page 1
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(await screen.findByText('Meal 1')).toBeInTheDocument()
  })

  it('meals tab shows the spec columns', async () => {
    mockFetch({
      '/api/meals': () => [
        meal({
          date: '2026-05-25',
          meal_type: 'lunch',
          food_name: 'Chicken',
          quantity: 150,
          unit: 'g',
          calories: 247,
          protein_g: 46.5,
          carbs_g: 0,
          fat_g: 5.4,
        }),
      ],
      '/api/water': () => [],
      '/api/exercise': () => [],
      '/api/weight': () => [],
    })

    render(<History />)

    const table = await screen.findByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual([
      'Date',
      'Meal',
      'Food',
      'Quantity',
      'Calories',
      'Protein',
      'Carbs',
      'Fat',
    ])
    // row data
    const row = within(table).getAllByRole('row')[1]
    expect(within(row).getByText('2026-05-25')).toBeInTheDocument()
    expect(within(row).getByText('lunch')).toBeInTheDocument()
    expect(within(row).getByText('Chicken')).toBeInTheDocument()
    expect(within(row).getByText('150 g')).toBeInTheDocument()
  })
})
