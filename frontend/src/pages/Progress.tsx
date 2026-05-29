import { useState } from 'react'
import { apiClient } from '../api/client'
import { WeightTrendChart } from '../components/progress/WeightTrendChart'
import { CalorieWeekChart } from '../components/progress/CalorieWeekChart'
import { CalorieCalculator } from '../components/progress/CalorieCalculator'
import { NutritionGoalsForm } from '../components/progress/NutritionGoalsForm'

type Goals = {
  calorie_goal: number | null
}

export default function Progress() {
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null)
  const [goalsRefreshKey, setGoalsRefreshKey] = useState(0)

  async function handleApplyGoal(kcal: number) {
    await apiClient.patch<Goals>('/goals', { calorie_goal: kcal })
    setGoalsRefreshKey((k) => k + 1)
  }

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Progress</h1>

      <WeightTrendChart />

      <CalorieWeekChart calorieGoal={calorieGoal} />

      <section aria-labelledby="goals-heading" className="mt-8">
        <h2 id="goals-heading" className="text-lg font-semibold">
          Nutritional goals
        </h2>

        <CalorieCalculator onApplyGoal={handleApplyGoal} />

        <NutritionGoalsForm
          refreshKey={goalsRefreshKey}
          onGoalsLoaded={setCalorieGoal}
        />
      </section>
    </section>
  )
}
