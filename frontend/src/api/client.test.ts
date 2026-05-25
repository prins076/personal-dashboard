import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiError } from './client'

const originalFetch = globalThis.fetch

describe('apiClient', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('prefixes requests with /api', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await apiClient.get<{ ok: boolean }>('/goals')

    const [url] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/goals')
  })

  it('throws ApiError with status on non-2xx responses', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('boom', { status: 500 }),
    )

    await expect(apiClient.get('/goals')).rejects.toBeInstanceOf(ApiError)
  })

  it('returns parsed JSON for 2xx responses', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ value: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const body = await apiClient.get<{ value: number }>('/goals')
    expect(body).toEqual({ value: 42 })
  })
})
