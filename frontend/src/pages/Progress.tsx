import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiClient } from '../api/client'

type Goals = {
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

type GoalField = Exclude<keyof Goals, 'id' | 'updated_at'>

type FieldSpec = {
  key: GoalField
  label: string
  step?: string
  min?: number
}

const FIELDS: readonly FieldSpec[] = [
  { key: 'calorie_goal', label: 'Calorie goal (kcal)', step: '1', min: 0 },
  { key: 'protein_goal_g', label: 'Protein goal (g)', step: '1', min: 0 },
  { key: 'carbs_goal_g', label: 'Carbs goal (g)', step: '1', min: 0 },
  { key: 'fat_goal_g', label: 'Fat goal (g)', step: '1', min: 0 },
  { key: 'fiber_goal_g', label: 'Fiber goal (g)', step: '1', min: 0 },
  { key: 'water_goal_ml', label: 'Water goal (ml)', step: '50', min: 0 },
  { key: 'weight_goal_kg', label: 'Target weight (kg)', step: '0.1', min: 0 },
]

type FormState = Record<GoalField, string>

type WeightEntry = {
  id: number
  date: string
  weight_kg: number
  change_from_previous: number | null
}

function goalsToForm(goals: Goals): FormState {
  const out = {} as FormState
  for (const { key } of FIELDS) {
    const v = goals[key]
    out[key] = v === null || v === undefined ? '' : String(v)
  }
  return out
}

function diffPatch(form: FormState, base: Goals): Partial<Record<GoalField, number | null>> {
  const patch: Partial<Record<GoalField, number | null>> = {}
  for (const { key } of FIELDS) {
    const raw = form[key].trim()
    const next: number | null = raw === '' ? null : Number(raw)
    if (next !== null && Number.isNaN(next)) continue
    if (next !== base[key]) {
      patch[key] = next
    }
  }
  return patch
}

export default function Progress() {
  const [goals, setGoals] = useState<Goals | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [entries, setEntries] = useState<WeightEntry[] | null>(null)
  const [weightError, setWeightError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Goals>('/goals')
      .then((data) => {
        if (cancelled) return
        setGoals(data)
        setForm(goalsToForm(data))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load goals')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<WeightEntry[]>('/weight?days=30')
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setWeightError(err instanceof Error ? err.message : 'failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!goals || !form) return
    const patch = diffPatch(form, goals)
    setSaving(true)
    setError(null)
    try {
      const updated = await apiClient.patch<Goals>('/goals', patch)
      setGoals(updated)
      setForm(goalsToForm(updated))
      setSavedAt(updated.updated_at)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save goals')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Progress</h1>

      <div className="mt-6">
        <h2 className="text-lg font-medium text-gray-700">Weight — last 30 days</h2>

        {weightError && <p className="mt-2 text-sm text-red-600">{weightError}</p>}

        {entries && entries.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">No weight entries yet.</p>
        )}

        {entries && entries.length > 0 && (
          <div data-testid="weight-chart" className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={entries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tick={{ fontSize: 12 }}
                  unit=" kg"
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="weight_kg"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <section aria-labelledby="goals-heading" className="mt-8">
        <h2 id="goals-heading" className="text-lg font-semibold">
          Nutritional goals
        </h2>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {!form || !goals ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, step, min }) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{label}</span>
                <input
                  type="number"
                  step={step}
                  min={min}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </label>
            ))}

            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {savedAt && !saving && (
                <span className="text-xs text-gray-500">Saved {savedAt}</span>
              )}
            </div>
          </form>
        )}
      </section>
    </section>
  )
}
