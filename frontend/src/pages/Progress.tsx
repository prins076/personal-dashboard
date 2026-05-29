import { CalorieWeekChart } from '../components/progress/CalorieWeekChart'
import { WeightTrendChart } from '../components/progress/WeightTrendChart'

export default function Progress() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Progress</h1>

      <WeightTrendChart />

      <CalorieWeekChart calorieGoal={null} />
    </section>
  )
}
