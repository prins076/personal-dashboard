import { apiClient } from './client'

export type ExerciseCategory = 'cardio' | 'strength' | 'flexibility' | 'other'

export type ExerciseEntry = {
  id: number
  logged_at: string
  date: string
  name: string
  category: ExerciseCategory
  duration_min: number | null
  sets: number | null
  reps: number | null
  weight_kg: number | null
  distance_km: number | null
  calories_burned: number | null
  notes: string | null
}

export type ExerciseCreateInput = {
  name: string
  category: ExerciseCategory
  date?: string
  duration_min?: number | null
  sets?: number | null
  reps?: number | null
  weight_kg?: number | null
  distance_km?: number | null
  calories_burned?: number | null
  notes?: string | null
}

export type ExerciseUpdateInput = Partial<ExerciseCreateInput>

export function createExercise(input: ExerciseCreateInput): Promise<ExerciseEntry> {
  return apiClient.post<ExerciseEntry>('/exercise', input)
}

export function listExercise(date: string): Promise<ExerciseEntry[]> {
  return apiClient.get<ExerciseEntry[]>(`/exercise?date=${encodeURIComponent(date)}`)
}

export function deleteExercise(id: number): Promise<void> {
  return apiClient.delete<void>(`/exercise/${id}`)
}

export function updateExercise(id: number, input: ExerciseUpdateInput): Promise<ExerciseEntry> {
  return apiClient.patch<ExerciseEntry>(`/exercise/${id}`, input)
}
