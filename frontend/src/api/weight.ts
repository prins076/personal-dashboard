import { ApiError, apiClient } from './client'

export type WeightEntry = {
  id: number
  date: string
  weight_kg: number
  notes: string | null
  logged_at: string | null
}

export type WeightCreateInput = {
  weight_kg: number
  date?: string
  notes?: string | null
}

export type WeightCreateResult =
  | { conflict: false; entry: WeightEntry }
  | { conflict: true; existing: WeightEntry }

export async function createWeight(input: WeightCreateInput): Promise<WeightCreateResult> {
  try {
    const entry = await apiClient.post<WeightEntry>('/weight', input)
    return { conflict: false, entry }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const parsed = JSON.parse(e.body) as { error: string; existing: WeightEntry }
      return { conflict: true, existing: parsed.existing }
    }
    throw e
  }
}

export function deleteWeight(id: number): Promise<void> {
  return apiClient.delete<void>(`/weight/${id}`)
}
