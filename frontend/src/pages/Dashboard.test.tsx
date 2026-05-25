import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
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

function setWaterState(total: number, goal = 2500) {
  return {
    date: '2026-05-25',
    entries: [],
    daily_total_ml: total,
    water_goal_ml: goal,
    goal_percentage: goal > 0 ? (total / goal) * 100 : 0,
  }
}

describe('Dashboard water section', () => {
  beforeEach(() => {
    fetchMock = vi.fn() as FetchMock
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches and renders the daily water total vs goal on load', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(setWaterState(1250, 2500)))

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByTestId('water-total')).toHaveTextContent(/1250/)
    })
    expect(screen.getByTestId('water-goal')).toHaveTextContent(/2500/)
    const bar = screen.getByTestId('water-progress-bar-fill')
    expect(bar.style.width).toBe('50%')
  })

  it('clicking a quick-add button posts to /api/water and refreshes the bar', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(setWaterState(0, 2500)))
      .mockResolvedValueOnce(
        jsonResponse({
          entry: {
            id: 1,
            date: '2026-05-25',
            amount_ml: 250,
            notes: null,
            logged_at: null,
          },
          daily_total_ml: 250,
        }, 201),
      )
      .mockResolvedValueOnce(jsonResponse(setWaterState(250, 2500)))

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByTestId('water-total')).toHaveTextContent(/0/)
    })

    const user = userEvent.setup()
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+250\s*ml/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('water-total')).toHaveTextContent(/250/)
    })

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/water' && init?.method === 'POST',
    )
    expect(postCall).toBeDefined()
    expect(JSON.parse(postCall![1]!.body as string)).toEqual({ amount_ml: 250 })
  })

  it('renders all three quick-add buttons (+150, +250, +500)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(setWaterState(0, 2500)))

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+150\s*ml/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /\+250\s*ml/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+500\s*ml/i })).toBeInTheDocument()
  })
})
