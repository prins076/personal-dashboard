import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/client'
import type { MealEntry } from '../api/meals'
import type { ExerciseEntry } from '../api/exercise'

type WaterEntry = {
  id: number
  date: string
  amount_ml: number
  notes: string | null
  logged_at: string | null
}

type WeightEntry = {
  id: number
  date: string
  weight_kg: number
  notes: string | null
  logged_at: string | null
  change_from_previous: number | null
}

type TabKey = 'meals' | 'water' | 'exercise' | 'weight'

const TABS: readonly { key: TabKey; label: string; path: string }[] = [
  { key: 'meals', label: 'Meals', path: '/meals' },
  { key: 'water', label: 'Water', path: '/water' },
  { key: 'exercise', label: 'Exercise', path: '/exercise' },
  { key: 'weight', label: 'Weight', path: '/weight' },
]

const PAGE_SIZE = 20

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function buildQuery(start: string, end: string): string {
  const parts: string[] = []
  if (isValidIsoDate(start)) parts.push(`start=${start}`)
  if (isValidIsoDate(end)) parts.push(`end=${end}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

function MealsTable({ rows }: { rows: MealEntry[] }) {
  return (
    <table className="w-full table-auto text-sm">
      <thead className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2">Date</th>
          <th className="px-3 py-2">Meal</th>
          <th className="px-3 py-2">Food</th>
          <th className="px-3 py-2">Quantity</th>
          <th className="px-3 py-2">Calories</th>
          <th className="px-3 py-2">Protein</th>
          <th className="px-3 py-2">Carbs</th>
          <th className="px-3 py-2">Fat</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((e) => (
          <tr key={e.id}>
            <td className="px-3 py-2">{e.date}</td>
            <td className="px-3 py-2">{e.meal_type}</td>
            <td className="px-3 py-2">{e.food_name}</td>
            <td className="px-3 py-2">{`${e.quantity} ${e.unit}`}</td>
            <td className="px-3 py-2">{e.calories ?? '—'}</td>
            <td className="px-3 py-2">{e.protein_g ?? '—'}</td>
            <td className="px-3 py-2">{e.carbs_g ?? '—'}</td>
            <td className="px-3 py-2">{e.fat_g ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WaterTable({ rows }: { rows: WaterEntry[] }) {
  return (
    <table className="w-full table-auto text-sm">
      <thead className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2">Date</th>
          <th className="px-3 py-2">Amount (ml)</th>
          <th className="px-3 py-2">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((e) => (
          <tr key={e.id}>
            <td className="px-3 py-2">{e.date}</td>
            <td className="px-3 py-2">{e.amount_ml}</td>
            <td className="px-3 py-2">{e.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ExerciseTable({ rows }: { rows: ExerciseEntry[] }) {
  const setsReps = (e: ExerciseEntry) =>
    e.sets != null && e.reps != null ? `${e.sets}×${e.reps}` : '—'
  return (
    <table className="w-full table-auto text-sm">
      <thead className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2">Date</th>
          <th className="px-3 py-2">Name</th>
          <th className="px-3 py-2">Category</th>
          <th className="px-3 py-2">Duration</th>
          <th className="px-3 py-2">Sets/Reps</th>
          <th className="px-3 py-2">Weight</th>
          <th className="px-3 py-2">Distance</th>
          <th className="px-3 py-2">Calories burned</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((e) => (
          <tr key={e.id}>
            <td className="px-3 py-2">{e.date}</td>
            <td className="px-3 py-2">{e.name}</td>
            <td className="px-3 py-2">{e.category}</td>
            <td className="px-3 py-2">
              {e.duration_min != null ? `${e.duration_min} min` : '—'}
            </td>
            <td className="px-3 py-2">{setsReps(e)}</td>
            <td className="px-3 py-2">{e.weight_kg != null ? `${e.weight_kg} kg` : '—'}</td>
            <td className="px-3 py-2">
              {e.distance_km != null ? `${e.distance_km} km` : '—'}
            </td>
            <td className="px-3 py-2">{e.calories_burned ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WeightTable({ rows }: { rows: WeightEntry[] }) {
  return (
    <table className="w-full table-auto text-sm">
      <thead className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2">Date</th>
          <th className="px-3 py-2">Weight (kg)</th>
          <th className="px-3 py-2">Change from previous</th>
          <th className="px-3 py-2">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((e) => (
          <tr key={e.id}>
            <td className="px-3 py-2">{e.date}</td>
            <td className="px-3 py-2">{e.weight_kg}</td>
            <td className="px-3 py-2">
              {e.change_from_previous == null
                ? '—'
                : e.change_from_previous > 0
                  ? `+${e.change_from_previous}`
                  : String(e.change_from_previous)}
            </td>
            <td className="px-3 py-2">{e.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function History() {
  const initialStart = useMemo(() => daysAgoIso(30), [])
  const initialEnd = useMemo(todayIso, [])

  const [tab, setTab] = useState<TabKey>('meals')
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [page, setPage] = useState(1)

  const [meals, setMeals] = useState<MealEntry[]>([])
  const [waters, setWaters] = useState<WaterEntry[]>([])
  const [exercises, setExercises] = useState<ExerciseEntry[]>([])
  const [weights, setWeights] = useState<WeightEntry[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const query = buildQuery(start, end)
    setLoading(true)
    setError(null)

    const path = TABS.find((t) => t.key === tab)!.path

    const promise = (() => {
      switch (tab) {
        case 'meals':
          return apiClient
            .get<MealEntry[]>(`${path}${query}`)
            .then((data) => !cancelled && setMeals(data))
        case 'water':
          return apiClient
            .get<WaterEntry[]>(`${path}${query}`)
            .then((data) => !cancelled && setWaters(data))
        case 'exercise':
          return apiClient
            .get<ExerciseEntry[]>(`${path}${query}`)
            .then((data) => !cancelled && setExercises(data))
        case 'weight':
          return apiClient
            .get<WeightEntry[]>(`${path}${query}`)
            .then((data) => !cancelled && setWeights(data))
      }
    })()

    promise
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    setPage(1)

    return () => {
      cancelled = true
    }
  }, [tab, start, end])

  const rows: unknown[] =
    tab === 'meals'
      ? meals
      : tab === 'water'
        ? waters
        : tab === 'exercise'
          ? exercises
          : weights

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">History</h1>

      <div role="tablist" className="mt-4 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'border-b-2 border-indigo-600 dark:border-indigo-400 px-3 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-400'
                : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          <span className="text-gray-600 dark:text-gray-400">From</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-gray-600 dark:text-gray-400">To</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
        {loading && rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No entries for the selected range.</p>
        ) : tab === 'meals' ? (
          <MealsTable rows={meals.slice(pageStart, pageEnd)} />
        ) : tab === 'water' ? (
          <WaterTable rows={waters.slice(pageStart, pageEnd)} />
        ) : tab === 'exercise' ? (
          <ExerciseTable rows={exercises.slice(pageStart, pageEnd)} />
        ) : (
          <WeightTable rows={weights.slice(pageStart, pageEnd)} />
        )}
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages} · {rows.length} entries
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-gray-300 dark:border-gray-700 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-gray-300 dark:border-gray-700 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
