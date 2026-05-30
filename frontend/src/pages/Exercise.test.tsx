import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Exercise from './Exercise'
import type { ExerciseEntry } from '../api/exercise'

const originalFetch = globalThis.fetch
type FetchMock = ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeEntry(overrides: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    id: 1,
    logged_at: '2026-05-25 10:00:00',
    date: '2026-05-25',
    name: 'Morning run',
    category: 'cardio',
    duration_min: 30,
    sets: null,
    reps: null,
    weight_kg: null,
    distance_km: 5,
    calories_burned: 300,
    notes: null,
    ...overrides,
  }
}

describe('Exercise page', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("lists today's exercise entries on load", async () => {
    const entry = makeEntry()
    ;(globalThis.fetch as unknown as FetchMock).mockResolvedValueOnce(jsonResponse([entry]))

    render(<Exercise />)

    expect(await screen.findByText('Morning run')).toBeInTheDocument()
    expect(screen.getByText(/cardio/i)).toBeInTheDocument()
    const [url] = (globalThis.fetch as unknown as FetchMock).mock.calls[0]
    expect(String(url)).toMatch(/\/api\/exercise\?date=\d{4}-\d{2}-\d{2}$/)
  })

  it('shows an empty-state message when no entries today', async () => {
    ;(globalThis.fetch as unknown as FetchMock).mockResolvedValueOnce(jsonResponse([]))

    render(<Exercise />)

    expect(await screen.findByText(/no exercise/i)).toBeInTheDocument()
  })

  it('submits the add modal and shows the new entry without a reload', async () => {
    const user = userEvent.setup()
    const newEntry = makeEntry({
      id: 2,
      name: 'Squats',
      category: 'strength',
      duration_min: null,
      sets: 3,
      reps: 10,
      weight_kg: 80,
      distance_km: null,
      calories_burned: null,
    })
    const fetchMock = globalThis.fetch as unknown as FetchMock
    fetchMock.mockResolvedValueOnce(jsonResponse([])) // initial load
    fetchMock.mockResolvedValueOnce(jsonResponse(newEntry, 201)) // POST

    render(<Exercise />)
    await screen.findByText(/no exercise/i)

    await user.click(screen.getByRole('button', { name: /add exercise/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/name/i), 'Squats')
    await user.selectOptions(within(dialog).getByLabelText(/category/i), 'strength')
    await user.type(within(dialog).getByLabelText(/sets/i), '3')
    await user.type(within(dialog).getByLabelText(/reps/i), '10')
    await user.type(within(dialog).getByLabelText(/weight/i), '80')

    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Squats')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const postCall = fetchMock.mock.calls[1]
    expect(postCall[0]).toBe('/api/exercise')
    expect(postCall[1].method).toBe('POST')
    const body = JSON.parse(postCall[1].body as string)
    expect(body.name).toBe('Squats')
    expect(body.category).toBe('strength')
    expect(body.sets).toBe(3)
    expect(body.reps).toBe(10)
    expect(body.weight_kg).toBe(80)
  })

})
