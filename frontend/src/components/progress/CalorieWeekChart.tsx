import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiClient } from '../../api/client'
import { useChartColors } from './useChartColors'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

type WeekDay = {
  date: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

type WeekBarDatum = {
  date: string
  label: (typeof DAY_LABELS)[number]
  calories: number | null
  is_future: boolean
}

function toBarData(week: WeekDay[]): WeekBarDatum[] {
  return week.slice(0, 7).map((entry, i) => ({
    date: entry.date,
    label: DAY_LABELS[i],
    calories: entry.calories,
    is_future: entry.calories === null,
  }))
}

type WeekTooltipPayload = {
  payload: WeekBarDatum
  value: number | null
}

function CalorieWeekTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: WeekTooltipPayload[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0].payload
  if (datum.is_future) return null
  return (
    <div className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs shadow">
      <div className="font-medium">{datum.label}</div>
      <div>{datum.calories ?? 0} kcal</div>
    </div>
  )
}

export function CalorieWeekChart({ calorieGoal }: { calorieGoal: number | null }) {
  const colors = useChartColors()
  const [week, setWeek] = useState<WeekDay[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<WeekDay[]>('/dashboard/week')
      .then((data) => {
        if (!cancelled) setWeek(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">Calories — this week</h2>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {week !== null && (
        <>
          <div
            data-testid="calorie-week-chart"
            data-calorie-goal={calorieGoal ?? ''}
            className="mt-3 h-64 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={toBarData(week)}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: colors.axis }} />
                <YAxis tick={{ fontSize: 12, fill: colors.axis }} />
                <Tooltip content={<CalorieWeekTooltip />} />
                {calorieGoal !== null && (
                  <ReferenceLine
                    y={calorieGoal}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    label={{
                      value: `Goal ${calorieGoal}`,
                      position: 'insideTopRight',
                      fontSize: 11,
                      fill: '#dc2626',
                    }}
                  />
                )}
                <Bar dataKey="calories" isAnimationActive={false}>
                  {toBarData(week).map((d) => (
                    <Cell
                      key={d.date}
                      fill={d.is_future ? colors.futureBar : '#6366f1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul
            data-testid="week-day-summary"
            className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-gray-600 dark:text-gray-400"
          >
            {toBarData(week).map((d) => (
              <li
                key={d.date}
                data-day-state={d.is_future ? 'future' : 'past'}
                data-day-label={d.label}
                className={
                  d.is_future
                    ? 'rounded bg-gray-100 dark:bg-gray-700 px-1 py-1 text-gray-400 dark:text-gray-500'
                    : 'rounded bg-indigo-50 dark:bg-indigo-950 px-1 py-1 text-indigo-700 dark:text-indigo-300'
                }
              >
                <div className="font-medium">{d.label}</div>
                <div>{d.is_future ? '—' : `${d.calories ?? 0}`}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
