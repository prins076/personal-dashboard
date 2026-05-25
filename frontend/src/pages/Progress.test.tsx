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
    fetchMock.mockResolvedValueOnce(jsonResponse(defaultGoals))

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
    // weight_goal_kg is null — input renders empty
    expect(screen.getByLabelText(/target weight/i)).toHaveValue(null)
  })

  it('saves edited goals via PATCH and reflects the new values without reload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(defaultGoals))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...defaultGoals,
        calorie_goal: 2200,
        protein_goal_g: 180,
        weight_goal_kg: 75.5,
        updated_at: '2026-05-25 13:00:00',
      }),
    )

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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/api/goals')
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({
      calorie_goal: 2200,
      protein_goal_g: 180,
      weight_goal_kg: 75.5,
    })

    // Reflects server response without a reload
    await waitFor(() => {
      expect(screen.getByLabelText(/calorie goal/i)).toHaveValue(2200)
    })
    expect(screen.getByLabelText(/target weight/i)).toHaveValue(75.5)
  })
})
