import { useState } from 'react'
import { apiClient } from '../api/client'
import { CalorieCalculator } from '../components/progress/CalorieCalculator'
import { NutritionGoalsForm } from '../components/progress/NutritionGoalsForm'

type Goals = { calorie_goal: number | null }

export default function Settings() {
  const [goalsRefreshKey, setGoalsRefreshKey] = useState(0)

  async function handleApplyGoal(kcal: number) {
    await apiClient.patch<Goals>('/goals', { calorie_goal: kcal })
    setGoalsRefreshKey((k) => k + 1)
  }

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section aria-labelledby="goals-heading" className="mt-8">
        <h2 id="goals-heading" className="text-lg font-semibold">Nutritional goals</h2>

        <CalorieCalculator onApplyGoal={handleApplyGoal} />

        <NutritionGoalsForm
          refreshKey={goalsRefreshKey}
          onGoalsLoaded={() => {}}
        />
      </section>
    </section>
  )
}
