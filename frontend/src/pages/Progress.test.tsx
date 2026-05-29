import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Progress from './Progress'

type FetchMock = ReturnType<typeof vi.fn>

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Progress page — coordinator smoke tests', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockImplementation((input: unknown) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/dashboard/week')) return Promise.resolve(jsonResponse([]))
      return Promise.reject(new Error(`unexpected ${url}`))
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders without crashing and mounts both chart modules', async () => {
    render(
      <MemoryRouter>
        <Progress />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/weight — last 30 days/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/calories — this week/i)).toBeInTheDocument()
    expect(screen.queryByText(/nutritional goals/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/calorie calculator/i)).not.toBeInTheDocument()
  })
})
