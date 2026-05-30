import { useCallback, useEffect, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { apiClient } from '../api/client'
import { MEAL_TYPES, type MealEntry, type MealType } from '../api/meals'
import { createWeight } from '../api/weight'
import { AddFoodModal } from './Nutrition'
import { AddExerciseModal } from './Exercise'
import { useTheme } from '../hooks/useTheme'

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

type DashboardGoals = {
  id: number
  calorie_goal: number | null
  protein_goal_g: number | null
  carbs_goal_g: number | null
  fat_goal_g: number | null
  fiber_goal_g: number | null
  water_goal_ml: number | null
  weight_goal_kg: number | null
  updated_at: string
}

type DashboardWater = {
  date: string
  daily_total_ml: number
  water_goal_ml: number
  goal_percentage: number
}

type DashboardWeight = {
  latest: {
    id: number
    date: string
    weight_kg: number
    notes: string | null
    logged_at: string | null
  } | null
  change_from_previous: number | null
}

type DashboardExerciseEntry = {
  id: number
  name: string
  category: string
  duration_min: number | null
  calories_burned: number | null
}

type DashboardExercise = {
  date: string
  total_duration_min: number
  total_calories_burned: number
  entries: DashboardExerciseEntry[]
}

type DashboardToday = {
  date: string
  totals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number
  }
  goals: DashboardGoals | null
  meals: Record<MealType, MealEntry[]>
  water: DashboardWater
  weight: DashboardWeight
  exercise: DashboardExercise
}

const QUICK_ADD_AMOUNTS = [150, 250, 500] as const

function formatLabel(type: MealType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function CalorieRing({
  current,
  goal,
  onSaveGoal,
}: {
  current: number
  goal: number | null
  onSaveGoal: (goal: number) => Promise<void>
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const trackColor = isDark ? '#374151' : '#e5e7eb'
  const valueTextColor = isDark ? '#f3f4f6' : '#111827'
  const labelTextColor = isDark ? '#9ca3af' : '#6b7280'
  const target = goal ?? 0
  const percentage =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(target))
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const open = () => {
    setValue(String(target))
    setEditing(true)
  }

  useEffect(() => {
    if (!editing) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditing(false)
    }
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [editing])

  const submit = async () => {
    const next = Number(value)
    if (!Number.isFinite(next) || next <= 0) return
    setSaving(true)
    try {
      await onSaveGoal(next)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const radius = 56
  const stroke = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percentage / 100)

  return (
    <div
      data-testid="calorie-ring"
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex flex-col items-center"
    >
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle
          cx={70}
          cy={70}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={70}
          cy={70}
          r={radius}
          fill="none"
          stroke="#4f46e5"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        <text
          x={70}
          y={66}
          textAnchor="middle"
          fontSize="22"
          fontWeight="600"
          fill={valueTextColor}
        >
          {percentage}%
        </text>
        <text
          x={70}
          y={88}
          textAnchor="middle"
          fontSize="12"
          fill={labelTextColor}
        >
          of goal
        </text>
      </svg>
      <div
        ref={containerRef}
        className="relative mt-2 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
      >
        <span data-testid="calorie-current">{Math.round(current)}</span>
        <span>/</span>
        <span data-testid="calorie-goal">{target}</span>
        <span>kcal</span>
        <button
          type="button"
          aria-label="Edit calorie goal"
          onClick={open}
          className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
        {editing && (
          <div
            role="dialog"
            aria-label="Edit calorie goal"
            className="absolute left-1/2 top-full z-10 mt-2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            <input
              type="number"
              min={1}
              aria-label="Calorie goal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
                }
              }}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const MACRO_COLORS = {
  protein: '#4f46e5',
  carbs: '#f59e0b',
  fat: '#ef4444',
} as const

function MacroPie({
  protein,
  carbs,
  fat,
}: {
  protein: number
  carbs: number
  fat: number
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const tooltipStyle = isDark
    ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }
  const data = [
    { name: 'Protein', value: protein, color: MACRO_COLORS.protein },
    { name: 'Carbs', value: carbs, color: MACRO_COLORS.carbs },
    { name: 'Fat', value: fat, color: MACRO_COLORS.fat },
  ]
  const hasData = data.some((d) => d.value > 0)
  return (
    <div data-testid="macro-pie" className="flex flex-col gap-2">
      <div className="h-40 w-full">
        {hasData && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={60}
                innerRadius={32}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-600 dark:text-gray-400">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: d.color }}
            />
            <span>
              {d.name} {Math.round(d.value * 10) / 10} g
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WaterBar({
  data,
  busy,
  onAdd,
}: {
  data: DashboardWater
  busy: boolean
  onAdd: (amount: number) => void
}) {
  const total = data.daily_total_ml
  const goal = data.water_goal_ml
  const percentage = goal > 0 ? Math.min(100, (total / goal) * 100) : 0
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Water</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span data-testid="water-total">{total}</span>
          {' ml / '}
          <span data-testid="water-goal">{goal}</span>
          {' ml'}
        </p>
      </div>
      <div
        className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          data-testid="water-progress-bar-fill"
          className="h-full bg-sky-500 transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-3 flex gap-2">
        {QUICK_ADD_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={busy}
            onClick={() => onAdd(amount)}
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
          >
            +{amount}ml
          </button>
        ))}
      </div>
    </section>
  )
}

function MealsList({ meals }: { meals: Record<MealType, MealEntry[]> }) {
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="text-lg font-semibold">Today's meals</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MEAL_TYPES.map((type) => (
          <div
            key={type}
            data-testid={`dash-meals-${type}`}
            className="rounded border border-gray-100 p-3 dark:border-gray-800"
          >
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatLabel(type)}
            </h3>
            {meals[type].length === 0 ? (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Nothing logged.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {meals[type].map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <span className="font-medium">{entry.food_name}</span>
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                      {entry.quantity} {entry.unit}
                      {entry.calories != null && ` · ${entry.calories} kcal`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function WeightWidget({ data }: { data: DashboardWeight }) {
  return (
    <section
      data-testid="weight-widget"
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <h2 className="text-lg font-semibold">Weight</h2>
      {data.latest === null ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No weight logged yet.</p>
      ) : (
        <div className="mt-2">
          <p className="text-2xl font-semibold">{data.latest.weight_kg} kg</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">on {data.latest.date}</p>
          {data.change_from_previous !== null && (
            <p
              className={
                data.change_from_previous < 0
                  ? 'mt-1 text-sm text-emerald-600'
                  : data.change_from_previous > 0
                    ? 'mt-1 text-sm text-rose-600'
                    : 'mt-1 text-sm text-gray-500 dark:text-gray-400'
              }
            >
              {data.change_from_previous > 0 ? '+' : ''}
              {data.change_from_previous} kg vs previous
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function ExerciseSummary({ data }: { data: DashboardExercise }) {
  return (
    <section
      data-testid="exercise-summary"
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Exercise</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span>{data.total_duration_min}</span> min
          {data.total_calories_burned > 0 && (
            <span> · {Math.round(data.total_calories_burned)} kcal</span>
          )}
        </p>
      </div>
      {data.entries.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nothing logged today.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
          {data.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p className="font-medium">{entry.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{entry.category}</p>
              </div>
              {entry.duration_min != null && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{entry.duration_min} min</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function WaterQuickAddPopover({
  onAdd,
  onClose,
}: {
  onAdd: (amount: number) => void
  onClose: () => void
}) {
  return (
    <>
      <div
        data-testid="water-popover-backdrop"
        className="fixed inset-0 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        data-testid="water-quick-add-popover"
        role="dialog"
        aria-label="Quick add water"
        className="fixed bottom-24 right-6 rounded-lg bg-white dark:bg-gray-800 p-4 shadow-xl border border-gray-200 dark:border-gray-700"
        style={{ zIndex: 51 }}
      >
        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Add water</p>
        <div className="flex gap-2">
          {QUICK_ADD_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                onAdd(amount)
                onClose()
              }}
              className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
            >
              +{amount}ml
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

const FAB_OPTIONS = ['Nutrition', 'Water', 'Exercise', 'Weight'] as const
type FabOption = (typeof FAB_OPTIONS)[number]

function WeightEntryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [weightKg, setWeightKg] = useState('')
  const [date, setDate] = useState(todayIso)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [conflictDate, setConflictDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setConflictDate(null)
    try {
      const result = await createWeight({
        weight_kg: parseFloat(weightKg),
        date,
        notes: notes.trim() || null,
      })
      if (!result.conflict) {
        onCreated()
      } else {
        setConflictDate(result.existing.date)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log weight')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
        <h2 id="weight-modal-title" className="text-lg font-semibold dark:text-gray-100">
          Log Weight
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-gray-700 dark:text-gray-300">Weight (kg)</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700 dark:text-gray-300">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700 dark:text-gray-300">Notes</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          {conflictDate && (
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
              Weight already logged for {conflictDate}. Delete the existing entry first on the{' '}
              <a href="/history" className="underline">
                History page
              </a>
              .
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DashboardFAB({ onSelect }: { onSelect: (option: FabOption) => void }) {
  const [open, setOpen] = useState(false)

  function handleOption(label: FabOption) {
    setOpen(false)
    onSelect(label)
  }

  return (
    <>
      {open && (
        <div
          data-testid="fab-backdrop"
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col items-end gap-2 mb-2">
            {FAB_OPTIONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleOption(label)}
                className="rounded-full bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-label="Add entry"
          onClick={() => setOpen((o) => !o)}
          className="h-14 w-14 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" />
          </svg>
        </button>
      </div>
    </>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardToday | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await apiClient.get<DashboardToday>('/dashboard/today')
      setData(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load dashboard')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveCalorieGoal = useCallback(async (calorie_goal: number) => {
    const updated = await apiClient.patch<DashboardGoals>('/goals', {
      calorie_goal,
    })
    setData((prev) => (prev ? { ...prev, goals: updated } : prev))
  }, [])

  const addWater = useCallback(
    async (amount_ml: number) => {
      setBusy(true)
      try {
        await apiClient.post('/water', { amount_ml })
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed to log water')
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const [weightModalOpen, setWeightModalOpen] = useState(false)
  const [nutritionModalOpen, setNutritionModalOpen] = useState(false)
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false)
  const [waterPopoverOpen, setWaterPopoverOpen] = useState(false)

  function handleFabSelect(option: FabOption) {
    if (option === 'Weight') setWeightModalOpen(true)
    else if (option === 'Nutrition') setNutritionModalOpen(true)
    else if (option === 'Exercise') setExerciseModalOpen(true)
    else if (option === 'Water') setWaterPopoverOpen(true)
  }

  return (
    <>
      <section className="space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {!data ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <h2 className="text-lg font-semibold">Calories</h2>
                <div className="mt-3 flex justify-center">
                  <CalorieRing
                    current={data.totals.calories}
                    goal={data.goals?.calorie_goal ?? null}
                    onSaveGoal={saveCalorieGoal}
                  />
                </div>
              </section>
              <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <h2 className="text-lg font-semibold">Macros</h2>
                <MacroPie
                  protein={data.totals.protein_g}
                  carbs={data.totals.carbs_g}
                  fat={data.totals.fat_g}
                />
              </section>
            </div>

            <WaterBar data={data.water} busy={busy} onAdd={(a) => void addWater(a)} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <WeightWidget data={data.weight} />
              <ExerciseSummary data={data.exercise} />
            </div>

            <MealsList meals={data.meals} />
          </>
        )}
      </section>
      <DashboardFAB onSelect={handleFabSelect} />
      {weightModalOpen && (
        <WeightEntryModal
          onClose={() => setWeightModalOpen(false)}
          onCreated={() => {
            setWeightModalOpen(false)
            void refresh()
          }}
        />
      )}
      {nutritionModalOpen && (
        <AddFoodModal
          onClose={() => setNutritionModalOpen(false)}
          onCreated={() => {
            setNutritionModalOpen(false)
            void refresh()
          }}
        />
      )}
      {exerciseModalOpen && (
        <AddExerciseModal
          onClose={() => setExerciseModalOpen(false)}
          onCreated={() => {
            setExerciseModalOpen(false)
            void refresh()
          }}
        />
      )}
      {waterPopoverOpen && (
        <WaterQuickAddPopover
          onAdd={(amount) => void addWater(amount)}
          onClose={() => setWaterPopoverOpen(false)}
        />
      )}
    </>
  )
}
