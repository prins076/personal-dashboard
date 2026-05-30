import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { WeightTrendChart } from './WeightTrendChart'

type FetchMock = ReturnType<typeof vi.fn>

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const weightEntries = [
  { id: 1, date: '2026-05-22', weight_kg: 80.0, change_from_previous: null },
  { id: 2, date: '2026-05-23', weight_kg: 79.5, change_from_previous: -0.5 },
  { id: 3, date: '2026-05-25', weight_kg: 78.2, change_from_previous: -1.3 },
]

describe('WeightTrendChart', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders chart when weight entries exist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(weightEntries))
    render(<WeightTrendChart />)

    await waitFor(() => {
      expect(screen.getByTestId('weight-chart')).toBeInTheDocument()
    })
  })

  it('renders empty-state message when no entries exist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    render(<WeightTrendChart />)

    await waitFor(() => {
      expect(screen.getByText(/no weight entries/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('weight-chart')).not.toBeInTheDocument()
  })

  it('renders error message on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'))
    render(<WeightTrendChart />)

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })
})
