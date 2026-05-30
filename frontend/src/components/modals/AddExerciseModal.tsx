import { useState } from 'react'
import {
  createExercise,
  type ExerciseCategory,
  type ExerciseEntry,
} from '../../api/exercise'

const CATEGORIES: ExerciseCategory[] = ['cardio', 'strength', 'flexibility', 'other']

type AddExerciseModalProps = {
  onClose: () => void
  onCreated: (entry: ExerciseEntry) => void
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function AddExerciseModal({ onClose, onCreated }: AddExerciseModalProps) {
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
