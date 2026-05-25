import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMeal,
  deleteMeal,
  listMeals,
  updateMeal,
  type MealEntry,
  type MealsByType,
} from './meals'

const originalFetch = globalThis.fetch
type FetchMock = ReturnType<typeof vi.fn>

const sample: MealEntry = {
  id: 1,
  logged_at: '2026-05-25 09:00:00',
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
}

const empty: MealsByType = {
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
}

function mockJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('meals api', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('POSTs to /api/meals with the full macro payload', async () => {
    ;(globalThis.fetch as unknown as FetchMock).mockResolvedValue(mockJson(sample, 201))

    const result = await createMeal({
      food_name: 'Oats',
      meal_type: 'breakfast',
      quantity: 100,
      unit: 'g',
      calories: 389,
      protein_g: 16.9,
      carbs_g: 66.3,
      fat_g: 6.9,
      fiber_g: 10.6,
    })

    const [url, init] = (globalThis.fetch as unknown as FetchMock).mock.calls[0]
    expect(url).toBe('/api/meals')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.food_name).toBe('Oats')
    expect(body.meal_type).toBe('breakfast')
    expect(body.calories).toBe(389)
    expect(result).toEqual(sample)
  })

  it('GETs /api/meals?date=...', async () => {
    ;(globalThis.fetch as unknown as FetchMock).mockResolvedValue(
      mockJson({ ...empty, breakfast: [sample] }),
    )

    const grouped = await listMeals('2026-05-25')

    const [url] = (globalThis.fetch as unknown as FetchMock).mock.calls[0]
    expect(url).toBe('/api/meals?date=2026-05-25')
    expect(grouped.breakfast[0].food_name).toBe('Oats')
    expect(grouped.lunch).toEqual([])
  })

  it('DELETEs /api/meals/:id', async () => {
    ;(globalThis.fetch as unknown as FetchMock).mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await deleteMeal(42)

    const [url, init] = (globalThis.fetch as unknown as FetchMock).mock.calls[0]
    expect(url).toBe('/api/meals/42')
    expect(init.method).toBe('DELETE')
  })

  it('PATCHes /api/meals/:id with partial body', async () => {
    ;(globalThis.fetch as unknown as FetchMock).mockResolvedValue(
      mockJson({ ...sample, quantity: 50, calories: 195 }),
    )

    const updated = await updateMeal(1, { quantity: 50, calories: 195 })

    const [url, init] = (globalThis.fetch as unknown as FetchMock).mock.calls[0]
    expect(url).toBe('/api/meals/1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ quantity: 50, calories: 195 })
    expect(updated.quantity).toBe(50)
  })
})
