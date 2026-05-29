import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CalorieWeekChart } from './CalorieWeekChart'

type FetchMock = ReturnType<typeof vi.fn>

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Mon–Wed are past (calories set), Thu–Sun are future (calories null)
const weekData = [
  { date: '2026-05-18', calories: 1800, protein_g: 100, carbs_g: 200, fat_g: 60 },
  { date: '2026-05-19', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { date: '2026-05-20', calories: 1500, protein_g: 90, carbs_g: 180, fat_g: 50 },
  { date: '2026-05-21', calories: null, protein_g: null, carbs_g: null, fat_g: null },
  { date: '2026-05-22', calories: null, protein_g: null, carbs_g: null, fat_g: null },
  { date: '2026-05-23', calories: null, protein_g: null, carbs_g: null, fat_g: null },
  { date: '2026-05-24', calories: null, protein_g: null, carbs_g: null, fat_g: null },
]

describe('CalorieWeekChart', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders chart when entries exist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(weekData))
    render(<CalorieWeekChart calorieGoal={2000} />)

    await waitFor(() => {
      expect(screen.getByTestId('calorie-week-chart')).toBeInTheDocument()
    })
  })

  it('renders empty-state message when no entries exist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    render(<CalorieWeekChart calorieGoal={null} />)

    await waitFor(() => {
      expect(screen.getByText(/no data for this week/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('calorie-week-chart')).not.toBeInTheDocument()
  })

  it('renders error message on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'))
    render(<CalorieWeekChart calorieGoal={null} />)

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('renders day-state summary marking past vs future days', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(weekData))
    render(<CalorieWeekChart calorieGoal={null} />)

    await waitFor(() => {
      expect(screen.getByTestId('week-day-summary')).toBeInTheDocument()
    })

    const summary = screen.getByTestId('week-day-summary')
    expect(summary.querySelectorAll('[data-day-state="past"]').length).toBe(3)
    expect(summary.querySelectorAll('[data-day-state="future"]').length).toBe(4)

    const labels = Array.from(summary.querySelectorAll('[data-day-label]')).map(
      (el) => el.getAttribute('data-day-label'),
    )
    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('passes data-calorie-goal attribute from prop', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(weekData))
    render(<CalorieWeekChart calorieGoal={2000} />)

    const chart = await screen.findByTestId('calorie-week-chart')
    expect(chart.getAttribute('data-calorie-goal')).toBe('2000')
  })
})
