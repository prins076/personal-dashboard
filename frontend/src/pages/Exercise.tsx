import { useEffect, useMemo, useState } from 'react'
import {
  listExercise,
  type ExerciseEntry,
} from '../api/exercise'
import { AddExerciseModal } from '../components/modals/AddExerciseModal'

function todayIso(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function statLine(entry: ExerciseEntry): string {
  const parts: string[] = []
  if (entry.duration_min != null) parts.push(`${entry.duration_min} min`)
  if (entry.sets != null && entry.reps != null) {
    const weight = entry.weight_kg != null ? ` @ ${entry.weight_kg} kg` : ''
    parts.push(`${entry.sets}×${entry.reps}${weight}`)
  } else if (entry.weight_kg != null) {
    parts.push(`${entry.weight_kg} kg`)
  }
  if (entry.distance_km != null) parts.push(`${entry.distance_km} km`)
  if (entry.calories_burned != null) parts.push(`${entry.calories_burned} kcal`)
  return parts.join(' · ')
}

export default function Exercise() {
  const today = useMemo(todayIso, [])
  const [entries, setEntries] = useState<ExerciseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listExercise(today)
      .then((items) => {
        if (!cancelled) setEntries(items)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [today])

  return (
    <section className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exercise</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Add exercise
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No exercise logged today.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 rounded border border-gray-200 dark:border-gray-800">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="px-4 py-3"
              >
                <p className="font-medium">{entry.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="uppercase tracking-wide">{entry.category}</span>
                  {statLine(entry) && <span> · {statLine(entry)}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <AddExerciseModal
          onClose={() => setModalOpen(false)}
          onCreated={(entry) => {
            setEntries((prev) => [...prev, entry])
            setModalOpen(false)
          }}
        />
      )}
    </section>
  )
}
