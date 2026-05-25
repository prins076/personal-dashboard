import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../api/client'

type WaterEntry = {
  id: number
  date: string
  amount_ml: number
  notes: string | null
  logged_at: string | null
}

type WaterDay = {
  date: string
  entries: WaterEntry[]
  daily_total_ml: number
  water_goal_ml: number
  goal_percentage: number
}

type WaterCreated = {
  entry: WaterEntry
  daily_total_ml: number
}

const QUICK_ADD_AMOUNTS = [150, 250, 500] as const

function WaterSection() {
  const [state, setState] = useState<WaterDay | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.get<WaterDay>('/water')
      setState(data)
      setError(null)
    } catch {
      setError('Failed to load water')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addWater = useCallback(
    async (amount_ml: number) => {
      setBusy(true)
      try {
        await apiClient.post<WaterCreated>('/water', { amount_ml })
        await refresh()
      } catch {
        setError('Failed to log water')
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const total = state?.daily_total_ml ?? 0
  const goal = state?.water_goal_ml ?? 0
  const percentage = goal > 0 ? Math.min(100, (total / goal) * 100) : 0

  return (
    <section className="mt-6 rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Water</h2>
        <p className="text-sm text-gray-500">
          <span data-testid="water-total">{total}</span>
          {' ml / '}
          <span data-testid="water-goal">{goal}</span>
          {' ml'}
        </p>
      </div>
      <div
        className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100"
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
            onClick={() => void addWater(amount)}
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
          >
            +{amount}ml
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}

export default function Dashboard() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <WaterSection />
    </section>
  )
}
