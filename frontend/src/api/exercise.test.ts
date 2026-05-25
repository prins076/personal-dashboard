import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createExercise,
  deleteExercise,
  listExercise,
  updateExercise,
  type ExerciseEntry,
} from './exercise'

const originalFetch = globalThis.fetch

const sampleEntry: ExerciseEntry = {
  id: 1,
  logged_at: '2026-05-25 10:00:00',
  date: '2026-05-25',
  name: 'Run',
  category: 'cardio',
  duration_min: 30,
  sets: null,
  reps: null,
  weight_kg: null,
  distance_km: 5,
  calories_burned: 300,
  notes: null,
}

function mockJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('exercise api', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('POSTs to /api/exercise with the payload', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockJson(sampleEntry, 201),
    )

    const result = await createExercise({
      name: 'Run',
      category: 'cardio',
      duration_min: 30,
    })

    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/exercise')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Run',
      category: 'cardio',
      duration_min: 30,
    })
    expect(result).toEqual(sampleEntry)
  })

  it('GETs /api/exercise?date=YYYY-MM-DD', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockJson([sampleEntry]),
    )

    const entries = await listExercise('2026-05-25')

    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/exercise?date=2026-05-25')
    expect(init.method).toBe('GET')
    expect(entries).toEqual([sampleEntry])
  })

  it('DELETEs /api/exercise/:id', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await deleteExercise(7)

    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/exercise/7')
    expect(init.method).toBe('DELETE')
  })

  it('PATCHes /api/exercise/:id with partial body', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockJson({ ...sampleEntry, duration_min: 45 }),
    )

    const updated = await updateExercise(1, { duration_min: 45 })

    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/exercise/1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ duration_min: 45 })
    expect(updated.duration_min).toBe(45)
  })
})
