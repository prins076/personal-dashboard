import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createMeal,
  deleteMeal,
  listMeals,
  MEAL_TYPES,
  type MealEntry,
  type MealsByType,
  type MealType,
} from '../api/meals'
import { searchFood, type FoodSearchResult } from '../api/food'

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

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function scaleMacro(per100g: number | null, quantityG: number): number {
  if (per100g == null || !Number.isFinite(per100g)) return 0
  return round1((per100g * quantityG) / 100)
}

function formatLabel(type: MealType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

type AddFoodModalProps = {
  onClose: () => void
  onCreated: (entry: MealEntry) => void
}

type Step = 'search' | 'edit'

function AddFoodModal({ onClose, onCreated }: AddFoodModalProps) {
  const [step, setStep] = useState<Step>('search')

  // Search step state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Edit step state
  const [picked, setPicked] = useState<FoodSearchResult | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')
  const [calories, setCalories] = useState('0')
  const [proteinG, setProteinG] = useState('0')
  const [carbsG, setCarbsG] = useState('0')
  const [fatG, setFatG] = useState('0')
  const [fiberG, setFiberG] = useState('0')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSearch(event?: React.FormEvent) {
    event?.preventDefault()
    if (query.trim() === '') return
    setSearching(true)
    setSearchError(null)
    try {
      const items = await searchFood(query.trim())
      setResults(items)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'search failed')
    } finally {
      setSearching(false)
    }
  }

  function handlePick(result: FoodSearchResult) {
    setPicked(result)
    const q = 100
    setQuantity(String(q))
    setUnit('g')
    // Pre-fill scaled macros (per-100g values × q/100)
    setCalories(String(scaleMacro(result.calories, q)))
    setProteinG(String(scaleMacro(result.protein_g, q)))
    setCarbsG(String(scaleMacro(result.carbs_g, q)))
    setFatG(String(scaleMacro(result.fat_g, q)))
    setFiberG(String(scaleMacro(result.fiber_g, q)))
    setStep('edit')
  }

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault()
    if (!picked) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const entry = await createMeal({
        food_name: picked.name,
        meal_type: mealType,
        quantity: Number(quantity),
        unit: unit.trim() || 'g',
        calories: Number(calories),
        protein_g: Number(proteinG),
        carbs_g: Number(carbsG),
        fat_g: Number(fatG),
        fiber_g: Number(fiberG),
        food_id: picked.id ?? null,
      })
      onCreated(entry)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'failed to save')
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="add-food-title" className="text-lg font-semibold">
            {step === 'search' ? 'Add food' : `Log "${picked?.name}"`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-900"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {step === 'search' && (
          <form onSubmit={handleSearch} className="mt-4">
            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Search</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1"
                  placeholder="e.g. oats"
                  autoFocus
                />
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                  disabled={searching || query.trim() === ''}
                >
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </label>

            {searchError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {searchError}
              </p>
            )}

            <ul className="mt-4 max-h-64 divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200">
              {results.length === 0 && !searching && (
                <li className="px-3 py-2 text-sm text-gray-500">
                  No results yet — search for a food.
                </li>
              )}
              {results.map((result, idx) => (
                <li
                  key={`${result.source}-${result.id ?? result.off_id ?? idx}`}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span>{result.name}</span>
                      {result.source === 'local' && (
                        <span
                          className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
                          aria-label="Saved custom food"
                        >
                          Saved
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {result.brand ? `${result.brand} · ` : ''}
                      {result.calories ?? '?'} kcal / 100 g
                      {result.source === 'off' && (
                        <span className="ml-2 uppercase tracking-wide">off</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Select ${result.name}`}
                    onClick={() => handlePick(result)}
                    className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
                  >
                    Select
                  </button>
                </li>
              ))}
            </ul>
          </form>
        )}

        {step === 'edit' && picked && (
          <form onSubmit={handleConfirm} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">
                <span className="text-gray-600">Quantity</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 rounded border border-gray-300 px-2 py-1"
                  required
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-gray-600">Unit</span>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="mt-1 rounded border border-gray-300 px-2 py-1"
                  required
                />
              </label>
            </div>

            <fieldset className="rounded border border-gray-200 p-3">
              <legend className="px-1 text-xs font-medium uppercase tracking-wide text-gray-600">
                Macros (editable)
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col text-sm">
                  <span className="text-gray-600">Calories</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="text-gray-600">Protein (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={proteinG}
                    onChange={(e) => setProteinG(e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="text-gray-600">Carbs (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={carbsG}
                    onChange={(e) => setCarbsG(e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="text-gray-600">Fat (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={fatG}
                    onChange={(e) => setFatG(e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm">
                  <span className="text-gray-600">Fiber (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={fiberG}
                    onChange={(e) => setFiberG(e.target.value)}
                    className="mt-1 rounded border border-gray-300 px-2 py-1"
                    required
                  />
                </label>
              </div>
            </fieldset>

            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Meal type</span>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="mt-1 rounded border border-gray-300 px-2 py-1"
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatLabel(t)}
                  </option>
                ))}
              </select>
            </label>

            {submitError && (
              <p className="text-sm text-red-600" role="alert">
                {submitError}
              </p>
            )}

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep('search')}
                className="rounded border border-gray-300 px-3 py-1 text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-indigo-600 px-4 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function MealGroup({
  type,
  entries,
  onDelete,
}: {
  type: MealType
  entries: MealEntry[]
  onDelete: (entry: MealEntry) => void
}) {
  return (
    <section
      data-testid={`meal-group-${type}`}
      className="rounded-lg border border-gray-200 p-4"
    >
      <h2 className="text-base font-semibold">{formatLabel(type)}</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Nothing logged yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p className="font-medium">{entry.food_name}</p>
                <p className="text-xs text-gray-500">
                  {entry.quantity} {entry.unit}
                  {entry.calories != null && ` · ${entry.calories} kcal`}
                  {entry.protein_g != null && ` · ${entry.protein_g}g P`}
                  {entry.carbs_g != null && ` · ${entry.carbs_g}g C`}
                  {entry.fat_g != null && ` · ${entry.fat_g}g F`}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete ${entry.food_name}`}
                onClick={() => onDelete(entry)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
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

  async function handleDelete(entry: MealEntry) {
    try {
      await deleteMeal(entry.id)
      setMeals((prev) => ({
        ...prev,
        [entry.meal_type]: prev[entry.meal_type].filter((e) => e.id !== entry.id),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to delete meal')
    }
  }

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
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {MEAL_TYPES.map((type) => (
            <MealGroup
              key={type}
              type={type}
              entries={meals[type]}
              onDelete={handleDelete}
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
