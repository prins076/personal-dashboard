import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../../api/client'
import { useProfile } from '../../hooks/useProfile'
import { mifflinTdee, type ActivityLevel, type Sex } from '../../utils/mifflin'

type WeightEntry = {
  id: number
  date: string
  weight_kg: number
  change_from_previous: number | null
}

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extra_active: 'Extra Active',
}

export function CalorieCalculator({
  onApplyGoal,
}: {
  onApplyGoal: (kcal: number) => Promise<void>
}) {
  const { profile, updateProfile } = useProfile()

  const [entries, setEntries] = useState<WeightEntry[] | null>(null)

  const [calcSex, setCalcSex] = useState<Sex | ''>('')
  const [calcAge, setCalcAge] = useState('')
  const [calcHeight, setCalcHeight] = useState('')
  const [calcActivity, setCalcActivity] = useState<ActivityLevel | ''>('')
  const [calcWeight, setCalcWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<WeightEntry[]>('/weight?days=30')
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch(() => {
        if (!cancelled) setEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    if (profile.sex) setCalcSex(profile.sex)
    if (profile.age !== null) setCalcAge(String(profile.age))
    if (profile.height_cm !== null) setCalcHeight(String(profile.height_cm))
    if (profile.activity_level) setCalcActivity(profile.activity_level)
  }, [profile])

  const latestWeight = entries && entries.length > 0 ? entries[entries.length - 1].weight_kg : null
  const effectiveWeight =
    latestWeight !== null ? latestWeight : calcWeight.trim() !== '' ? Number(calcWeight) : null

  const suggestedKcal = useMemo(() => {
    if (
      calcSex === '' ||
      calcAge.trim() === '' ||
      calcHeight.trim() === '' ||
      calcActivity === '' ||
      effectiveWeight === null ||
      Number.isNaN(effectiveWeight)
    ) {
      return null
    }
    return mifflinTdee({
      sex: calcSex,
      activity_level: calcActivity,
      weight_kg: effectiveWeight,
      height_cm: Number(calcHeight),
      age: Number(calcAge),
    })
  }, [calcSex, calcAge, calcHeight, calcActivity, effectiveWeight])

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProfile({
        sex: calcSex || null,
        age: calcAge.trim() !== '' ? Number(calcAge) : null,
        height_cm: calcHeight.trim() !== '' ? Number(calcHeight) : null,
        activity_level: calcActivity || null,
      })
      setSavedAt(updated.updated_at)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleApplyGoal() {
    if (suggestedKcal === null) return
    setApplying(true)
    try {
      await onApplyGoal(suggestedKcal)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Calorie calculator (Mifflin-St Jeor)
      </h3>
      <form onSubmit={handleSaveProfile} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Sex</span>
          <select
            value={calcSex}
            onChange={(e) => setCalcSex(e.target.value as Sex | '')}
            className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Age (years)</span>
          <input
            type="number"
            min={0}
            step="1"
            value={calcAge}
            onChange={(e) => setCalcAge(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Height (cm)</span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={calcHeight}
            onChange={(e) => setCalcHeight(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Activity level</span>
          <select
            value={calcActivity}
            onChange={(e) => setCalcActivity(e.target.value as ActivityLevel | '')}
            className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Select…</option>
            {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {latestWeight === null && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Weight (kg)</span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={calcWeight}
              onChange={(e) => setCalcWeight(e.target.value)}
              placeholder="No weight logged yet"
              className="rounded border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
        )}

        <div className="sm:col-span-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Suggested maintenance calories:{' '}
            <strong className="text-gray-900 dark:text-gray-100" data-testid="suggested-kcal">
              {suggestedKcal !== null ? `${suggestedKcal} kcal` : '—'}
            </strong>
            {latestWeight !== null && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">
                (using latest weight {latestWeight} kg)
              </span>
            )}
          </p>
        </div>

        {error && (
          <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
        )}

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          <button
            type="button"
            disabled={suggestedKcal === null || applying}
            onClick={handleApplyGoal}
            className="rounded border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-50"
          >
            {applying ? 'Applying…' : 'Apply as goal'}
          </button>
          {savedAt && !saving && (
            <span className="text-xs text-gray-500 dark:text-gray-400">Saved {savedAt}</span>
          )}
        </div>
      </form>
    </div>
  )
}
