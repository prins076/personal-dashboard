import { describe, expect, it } from 'vitest'
import { mifflinTdee } from './mifflin'

describe('mifflinTdee', () => {
  const w = 70   // kg
  const h = 170  // cm
  const a = 25   // years

  it.each([
    // [sex, activity_level, expected_kcal]
    ['male',   'sedentary',         1971],
    ['male',   'lightly_active',    2258],
    ['male',   'moderately_active', 2546],
    ['male',   'very_active',       2833],
    ['male',   'extra_active',      3121],
    ['female', 'sedentary',         1772],
    ['female', 'lightly_active',    2030],
    ['female', 'moderately_active', 2289],
    ['female', 'very_active',       2547],
    ['female', 'extra_active',      2805],
  ] as const)('sex=%s activity=%s', (sex, activity, expected) => {
    expect(mifflinTdee({ sex, activity_level: activity, weight_kg: w, height_cm: h, age: a })).toBe(expected)
  })

  it('edge case: minimum plausible male inputs', () => {
    // age=18, height=100cm, weight=30kg
    expect(mifflinTdee({ sex: 'male', activity_level: 'sedentary', weight_kg: 30, height_cm: 100, age: 18 })).toBe(1008)
  })

  it('edge case: minimum plausible female inputs', () => {
    expect(mifflinTdee({ sex: 'female', activity_level: 'sedentary', weight_kg: 30, height_cm: 100, age: 18 })).toBe(809)
  })
})
