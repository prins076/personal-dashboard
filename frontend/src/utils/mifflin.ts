export type Sex = 'male' | 'female'
export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
}

export type MifflinParams = {
  sex: Sex
  activity_level: ActivityLevel
  weight_kg: number
  height_cm: number
  age: number
}

export function mifflinTdee({ sex, activity_level, weight_kg, height_cm, age }: MifflinParams): number {
  const bmr =
    10 * weight_kg +
    6.25 * height_cm -
    5 * age +
    (sex === 'male' ? 5 : -161)
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity_level])
}
