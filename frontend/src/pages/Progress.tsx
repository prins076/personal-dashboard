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

type WeightEntry = {
  id: number
  date: string
  weight_kg: number
  change_from_previous: number | null
}

export default function Progress() {
  const [entries, setEntries] = useState<WeightEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<WeightEntry[]>('/weight?days=30')
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Progress</h1>

      <div className="mt-6">
        <h2 className="text-lg font-medium text-gray-700">Weight — last 30 days</h2>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

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
    </section>
  )
}
