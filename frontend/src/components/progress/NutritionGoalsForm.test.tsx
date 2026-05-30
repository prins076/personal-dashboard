import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NutritionGoalsForm } from './NutritionGoalsForm'

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

describe('NutritionGoalsForm', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches /api/goals on mount and populates all fields', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(defaultGoals))
    render(<NutritionGoalsForm refreshKey={0} onGoalsLoaded={vi.fn()} />)

    expect(await screen.findByLabelText(/calorie goal/i)).toHaveValue(2000)
    expect(screen.getByLabelText(/protein/i)).toHaveValue(150)
    expect(screen.getByLabelText(/carbs/i)).toHaveValue(200)
    expect(screen.getByLabelText(/^fat/i)).toHaveValue(65)
    expect(screen.getByLabelText(/fiber/i)).toHaveValue(30)
    expect(screen.getByLabelText(/water/i)).toHaveValue(2500)
    expect(screen.getByLabelText(/target weight/i)).toHaveValue(null)
  })

  it('sends PATCH with only changed fields on submit', async () => {
    const updatedGoals = { ...defaultGoals, calorie_goal: 2200, updated_at: '2026-05-25 14:00:00' }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(defaultGoals))
      .mockResolvedValueOnce(jsonResponse(updatedGoals))

    const user = userEvent.setup()
    render(<NutritionGoalsForm refreshKey={0} onGoalsLoaded={vi.fn()} />)

    const calorieInput = await screen.findByLabelText(/calorie goal/i)
    await user.clear(calorieInput)
    await user.type(calorieInput, '2200')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    const patchCall = await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/goals' && (init as RequestInit)?.method === 'PATCH',
      )
      expect(call).toBeDefined()
      return call as [string, RequestInit]
    })

    const body = JSON.parse(patchCall[1].body as string)
    expect(body).toEqual({ calorie_goal: 2200 })
  })

  it('re-fetches and syncs form state when refreshKey changes', async () => {
    const updatedGoals = { ...defaultGoals, calorie_goal: 1800, updated_at: '2026-05-26 09:00:00' }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(defaultGoals))
      .mockResolvedValueOnce(jsonResponse(updatedGoals))

    const { rerender } = render(<NutritionGoalsForm refreshKey={0} onGoalsLoaded={vi.fn()} />)

    expect(await screen.findByLabelText(/calorie goal/i)).toHaveValue(2000)

    rerender(<NutritionGoalsForm refreshKey={1} onGoalsLoaded={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/calorie goal/i)).toHaveValue(1800)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('calls onGoalsLoaded with the calorie goal after each successful fetch', async () => {
    const updatedGoals = { ...defaultGoals, calorie_goal: 1500, updated_at: '2026-05-26 10:00:00' }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(defaultGoals))
      .mockResolvedValueOnce(jsonResponse(updatedGoals))

    const onGoalsLoaded = vi.fn()
    const { rerender } = render(<NutritionGoalsForm refreshKey={0} onGoalsLoaded={onGoalsLoaded} />)

    await waitFor(() => expect(onGoalsLoaded).toHaveBeenCalledWith(2000))

    rerender(<NutritionGoalsForm refreshKey={1} onGoalsLoaded={onGoalsLoaded} />)

    await waitFor(() => expect(onGoalsLoaded).toHaveBeenCalledWith(1500))
  })
})
