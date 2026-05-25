import { apiClient } from './client'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export type MealEntry = {
  id: number
  logged_at: string
  date: string
  meal_type: MealType
  food_id: number | null
  food_name: string
  quantity: number
  unit: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  notes: string | null
}

export type MealsByType = Record<MealType, MealEntry[]>

export type MealCreateInput = {
  food_name: string
  meal_type: MealType
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  date?: string
  food_id?: number | null
  notes?: string | null
}

export type MealUpdateInput = Partial<MealCreateInput>

export function createMeal(input: MealCreateInput): Promise<MealEntry> {
  return apiClient.post<MealEntry>('/meals', input)
}

export function listMeals(date?: string): Promise<MealsByType> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiClient.get<MealsByType>(`/meals${query}`)
}

export function deleteMeal(id: number): Promise<void> {
  return apiClient.delete<void>(`/meals/${id}`)
}

export function updateMeal(id: number, input: MealUpdateInput): Promise<MealEntry> {
  return apiClient.patch<MealEntry>(`/meals/${id}`, input)
}
