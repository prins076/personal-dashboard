import { useEffect, useMemo, useState } from 'react'
import {
  createExercise,
  listExercise,
  type ExerciseCategory,
  type ExerciseEntry,
} from '../api/exercise'

const CATEGORIES: ExerciseCategory[] = ['cardio', 'strength', 'flexibility', 'other']

function todayIso(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

type AddModalProps = {
  onClose: () => void
  onCreated: (entry: ExerciseEntry) => void
}

function AddExerciseModal({ onClose, onCreated }: AddModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('cardio')
  const [durationMin, setDurationMin] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [caloriesBurned, setCaloriesBurned] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = submitting || name.trim() === ''

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const created = await createExercise({
        name: name.trim(),
        category,
        duration_min: parseOptionalNumber(durationMin),
        sets: parseOptionalNumber(sets),
        reps: parseOptionalNumber(reps),
        weight_kg: parseOptionalNumber(weightKg),
        distance_km: parseOptionalNumber(distanceKm),
        calories_burned: parseOptionalNumber(caloriesBurned),
        notes: notes.trim() === '' ? null : notes.trim(),
      })
      onCreated(created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save')
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-exercise-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl"
      >
        <h2 id="add-exercise-title" className="text-lg font-semibold">
          Add exercise
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="col-span-2 flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
              required
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Duration (min)</span>
            <input
              type="number"
              min="0"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Sets</span>
            <input
              type="number"
              min="0"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Reps</span>
            <input
              type="number"
              min="0"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Weight (kg)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Distance (km)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Calories burned</span>
            <input
              type="number"
              min="0"
              value={caloriesBurned}
              onChange={(e) => setCaloriesBurned(e.target.value)}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            />
          </label>

          <label className="col-span-2 flex flex-col text-sm">
            <span className="text-gray-600 dark:text-gray-400">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 rounded border border-gray-300 dark:border-gray-700 px-2 py-1"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 dark:border-gray-700 px-3 py-1 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
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
