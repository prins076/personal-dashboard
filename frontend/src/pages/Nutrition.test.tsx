import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Nutrition from './Nutrition'
import type { MealEntry, MealsByType } from '../api/meals'

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function emptyMeals(): MealsByType {
  return { breakfast: [], lunch: [], dinner: [], snack: [] }
}

function makeMeal(overrides: Partial<MealEntry> = {}): MealEntry {
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

function mockFetchByUrl(handlers: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    for (const [pattern, fn] of Object.entries(handlers)) {
      if (url.startsWith(pattern)) return fn()
    }
    throw new Error(`Unhandled fetch: ${url}`)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe('Nutrition page', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("lists today's meals grouped by meal type on load", async () => {
    mockFetchByUrl({
      '/api/meals': () =>
        jsonResponse({
          ...emptyMeals(),
          breakfast: [makeMeal({ food_name: 'Oats' })],
          lunch: [makeMeal({ id: 2, food_name: 'Chicken', meal_type: 'lunch' })],
        }),
    })

    render(<Nutrition />)

    expect(await screen.findByText('Oats')).toBeInTheDocument()
    expect(screen.getByText('Chicken')).toBeInTheDocument()

    const breakfast = screen.getByTestId('meal-group-breakfast')
    expect(within(breakfast).getByText('Oats')).toBeInTheDocument()
    const lunch = screen.getByTestId('meal-group-lunch')
    expect(within(lunch).getByText('Chicken')).toBeInTheDocument()
  })

  it('shows an empty-state under each meal type when none logged', async () => {
    mockFetchByUrl({
      '/api/meals': () => jsonResponse(emptyMeals()),
    })

    render(<Nutrition />)

    for (const type of ['breakfast', 'lunch', 'dinner', 'snack']) {
      const group = await screen.findByTestId(`meal-group-${type}`)
      expect(within(group).getByText(/nothing logged/i)).toBeInTheDocument()
    }
  })

  it('deletes a meal when delete button is clicked', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/meals/42') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      if (url.startsWith('/api/meals')) {
        return jsonResponse({
          ...emptyMeals(),
          breakfast: [makeMeal({ id: 42, food_name: 'Oats' })],
        })
      }
      throw new Error(`Unhandled fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<Nutrition />)

    expect(await screen.findByText('Oats')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /delete oats/i }))

    await waitFor(() => {
      expect(screen.queryByText('Oats')).not.toBeInTheDocument()
    })
  })

  it('food search modal: search → pick → quantity → editable macros → confirm', async () => {
    const calls: { url: string; method: string; body: string | null }[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const body = init?.body ? String(init.body) : null
      calls.push({ url, method, body })

      if (url.startsWith('/api/meals') && method === 'POST') {
        const parsed = JSON.parse(body!)
        return jsonResponse(
          makeMeal({
            id: 99,
            food_name: parsed.food_name,
            meal_type: parsed.meal_type,
            quantity: parsed.quantity,
            unit: parsed.unit,
            calories: parsed.calories,
            protein_g: parsed.protein_g,
            carbs_g: parsed.carbs_g,
            fat_g: parsed.fat_g,
            fiber_g: parsed.fiber_g,
          }),
          201,
        )
      }
      if (url.startsWith('/api/meals')) {
        return jsonResponse(emptyMeals())
      }
      if (url.startsWith('/api/food/search')) {
        return jsonResponse([
          {
            id: null,
            off_id: '12345',
            name: 'Oats, rolled',
            brand: 'Quaker',
            serving_g: 40,
            calories: 389,
            protein_g: 16.9,
            carbs_g: 66.3,
            fat_g: 6.9,
            fiber_g: 10.6,
            source: 'off',
          },
        ])
      }
      throw new Error(`Unhandled fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<Nutrition />)

    await screen.findByTestId('meal-group-breakfast')

    await user.click(screen.getByRole('button', { name: /add food/i }))
    const dialog = await screen.findByRole('dialog')

    const searchInput = within(dialog).getByLabelText(/search/i)
    await user.type(searchInput, 'oats')
    await user.click(within(dialog).getByRole('button', { name: /^search$/i }))

    expect(await within(dialog).findByText(/Oats, rolled/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /select oats, rolled/i }))

    // Quantity defaults to 100; user enters quantity & unit and sees editable macros
    const quantityInput = within(dialog).getByLabelText(/quantity/i)
    await user.clear(quantityInput)
    await user.type(quantityInput, '100')

    const unitInput = within(dialog).getByLabelText(/unit/i)
    await user.clear(unitInput)
    await user.type(unitInput, 'g')

    // Editable macros must be visible (pre-filled from scaled OFF values)
    const calInput = within(dialog).getByLabelText(/calories/i) as HTMLInputElement
    expect(calInput.value).toBe('389')
    const proteinInput = within(dialog).getByLabelText(/protein/i) as HTMLInputElement
    expect(proteinInput.value).toBe('16.9')

    // User edits a macro before confirming
    await user.clear(calInput)
    await user.type(calInput, '400')

    // Meal type selector
    await user.selectOptions(within(dialog).getByLabelText(/meal type/i), 'breakfast')

    await user.click(within(dialog).getByRole('button', { name: /confirm/i }))

    // New entry appears under breakfast without a page reload
    await waitFor(() => {
      const group = screen.getByTestId('meal-group-breakfast')
      expect(within(group).getByText('Oats, rolled')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const postCall = calls.find((c) => c.url === '/api/meals' && c.method === 'POST')!
    const postBody = JSON.parse(postCall.body!)
    expect(postBody.food_name).toBe('Oats, rolled')
    expect(postBody.meal_type).toBe('breakfast')
    expect(postBody.quantity).toBe(100)
    expect(postBody.unit).toBe('g')
    expect(postBody.calories).toBe(400)
    expect(postBody.protein_g).toBe(16.9)
  })
})
