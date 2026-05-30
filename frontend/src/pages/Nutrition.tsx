import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listMeals,
  MEAL_TYPES,
  type MealEntry,
  type MealsByType,
  type MealType,
} from '../api/meals'
import { AddFoodModal } from '../components/modals/AddFoodModal'

function todayIso(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function emptyMeals(): MealsByType {
  return { breakfast: [], lunch: [], dinner: [], snack: [] }
}

function formatLabel(type: MealType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function MealGroup({
  type,
  entries,
}: {
  type: MealType
  entries: MealEntry[]
}) {
  return (
    <section
      data-testid={`meal-group-${type}`}
      className="rounded-lg border border-gray-200 dark:border-gray-800 p-4"
    >
      <h2 className="text-base font-semibold">{formatLabel(type)}</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nothing logged yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="py-2 text-sm"
            >
              <p className="font-medium">{entry.food_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {entry.quantity} {entry.unit}
                {entry.calories != null && ` · ${entry.calories} kcal`}
                {entry.protein_g != null && ` · ${entry.protein_g}g P`}
                {entry.carbs_g != null && ` · ${entry.carbs_g}g C`}
                {entry.fat_g != null && ` · ${entry.fat_g}g F`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Nutrition() {
  const today = useMemo(todayIso, [])
  const [meals, setMeals] = useState<MealsByType>(emptyMeals())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listMeals(today)
      setMeals(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load meals')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    void load()
  }, [load])

  function handleCreated(entry: MealEntry) {
    setMeals((prev) => ({
      ...prev,
      [entry.meal_type]: [...prev[entry.meal_type], entry],
    }))
    setModalOpen(false)
  }

  return (
    <section className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nutrition</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Add food
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {MEAL_TYPES.map((type) => (
            <MealGroup
              key={type}
              type={type}
              entries={meals[type]}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <AddFoodModal
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </section>
  )
}
