import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Progress from './Progress'

const originalFetch = globalThis.fetch

describe('Progress page — 30-day weight chart', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches weight entries from /api/weight?days=30 and renders the chart', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: 1, date: '2026-05-22', weight_kg: 80.0, change_from_previous: null },
          { id: 2, date: '2026-05-23', weight_kg: 79.5, change_from_previous: -0.5 },
          { id: 3, date: '2026-05-25', weight_kg: 78.2, change_from_previous: -1.3 },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    render(<Progress />)

    await waitFor(() => {
      const [url] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toBe('/api/weight?days=30')
    })

    await waitFor(() => {
      expect(screen.getByTestId('weight-chart')).toBeInTheDocument()
    })
  })

  it('renders an empty state when no entries are returned', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    render(<Progress />)

    await waitFor(() => {
      expect(screen.getByText(/no weight entries/i)).toBeInTheDocument()
    })
  })
})
