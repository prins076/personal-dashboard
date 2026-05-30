import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { CalorieWeekChart } from '../components/progress/CalorieWeekChart'
import { WeightTrendChart } from '../components/progress/WeightTrendChart'

type Goals = { calorie_goal: number | null }

export default function Progress() {
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Goals>('/goals')
      .then((data) => {
        if (!cancelled) setCalorieGoal(data.calorie_goal)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Progress</h1>

      <WeightTrendChart />

      <CalorieWeekChart calorieGoal={calorieGoal} />
    </section>
  )
}
