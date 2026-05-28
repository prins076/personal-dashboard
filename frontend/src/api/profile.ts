import { apiClient } from './client'
import type { ActivityLevel, Sex } from '../utils/mifflin'

export type Profile = {
  id: number
  age: number | null
  sex: Sex | null
  height_cm: number | null
  activity_level: ActivityLevel | null
  updated_at: string
}

export type ProfilePatch = {
  age?: number | null
  sex?: Sex | null
  height_cm?: number | null
  activity_level?: ActivityLevel | null
}

export function getProfile(): Promise<Profile> {
  return apiClient.get<Profile>('/profile')
}

export function patchProfile(patch: ProfilePatch): Promise<Profile> {
  return apiClient.patch<Profile>('/profile', patch)
}
