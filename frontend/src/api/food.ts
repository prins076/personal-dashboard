import { apiClient } from './client'

export type FoodSource = 'local' | 'off'

export type FoodSearchResult = {
  id: number | null
  off_id: string | null
  name: string
  brand: string | null
  serving_g: number | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  source: FoodSource
}

export function searchFood(query: string, limit = 10): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  return apiClient.get<FoodSearchResult[]>(`/food/search?${params.toString()}`)
}
