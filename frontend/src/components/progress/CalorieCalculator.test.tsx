import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalorieCalculator } from './CalorieCalculator'

type FetchMock = ReturnType<typeof vi.fn>

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const emptyProfile = {
  id: 1,
  age: null,
  sex: null,
  height_cm: null,
  activity_level: null,
  updated_at: '2026-05-25 12:00:00',
}

const weightEntries = [
  { id: 1, date: '2026-05-25', weight_kg: 75.0, change_from_previous: null },
]

function mockFetch(fetchMock: FetchMock, opts: {
  weightEntries?: unknown[]
  profile?: unknown
} = {}) {
  const { weightEntries: entries = [], profile = emptyProfile } = opts
  fetchMock.mockImplementation((input: unknown) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse(entries))
    if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(profile))
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  })
}

describe('CalorieCalculator', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('hides manual weight input and shows latest weight when entries exist', async () => {
    mockFetch(fetchMock, { weightEntries })
    render(<CalorieCalculator onApplyGoal={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/using latest weight 75 kg/i)).toBeInTheDocument()
    })
    expect(screen.queryByLabelText(/^weight \(kg\)/i)).not.toBeInTheDocument()
  })

  it('shows manual weight input when no weight entries exist', async () => {
    mockFetch(fetchMock, { weightEntries: [] })
    render(<CalorieCalculator onApplyGoal={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/^weight \(kg\)/i)).toBeInTheDocument()
    })
  })

  it('updates suggested kcal when all fields are filled', async () => {
    mockFetch(fetchMock, { weightEntries })
    const user = userEvent.setup()
    render(<CalorieCalculator onApplyGoal={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/using latest weight 75 kg/i)).toBeInTheDocument()
    })

    const suggested = screen.getByTestId('suggested-kcal')
    expect(suggested).toHaveTextContent('—')

    await user.selectOptions(screen.getByLabelText(/^sex$/i), 'male')
    await user.clear(screen.getByLabelText(/^age/i))
    await user.type(screen.getByLabelText(/^age/i), '25')
    await user.clear(screen.getByLabelText(/^height/i))
    await user.type(screen.getByLabelText(/^height/i), '170')
    await user.selectOptions(screen.getByLabelText(/^activity level/i), 'sedentary')

    // male, 25y, 170cm, 75kg, sedentary → BMR = 10*75+6.25*170-5*25+5 = 1692.5 → TDEE = round(1692.5*1.2) = 2031
    expect(suggested).toHaveTextContent('2031 kcal')
  })

  it('calls onApplyGoal with suggested kcal when "Apply as goal" is clicked', async () => {
    mockFetch(fetchMock, { weightEntries })
    const onApplyGoal = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<CalorieCalculator onApplyGoal={onApplyGoal} />)

    await waitFor(() => {
      expect(screen.getByText(/using latest weight 75 kg/i)).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/^sex$/i), 'female')
    await user.clear(screen.getByLabelText(/^age/i))
    await user.type(screen.getByLabelText(/^age/i), '30')
    await user.clear(screen.getByLabelText(/^height/i))
    await user.type(screen.getByLabelText(/^height/i), '160')
    await user.selectOptions(screen.getByLabelText(/^activity level/i), 'sedentary')

    // female, 30y, 160cm, 75kg, sedentary → BMR = 10*75+6.25*160-5*30-161 = 1439 → TDEE = round(1439*1.2) = 1727
    await user.click(screen.getByRole('button', { name: /apply as goal/i }))

    expect(onApplyGoal).toHaveBeenCalledOnce()
    expect(onApplyGoal).toHaveBeenCalledWith(1727)
  })

  it('PATCHes /api/profile when "Save profile" is clicked', async () => {
    mockFetch(fetchMock, { weightEntries })
    const updatedProfile = {
      ...emptyProfile,
      sex: 'male',
      age: 28,
      height_cm: 178,
      activity_level: 'moderately_active',
      updated_at: '2026-05-28 10:00:00',
    }
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.startsWith('/api/weight')) return Promise.resolve(jsonResponse(weightEntries))
      if (url === '/api/profile' && init?.method === 'PATCH')
        return Promise.resolve(jsonResponse(updatedProfile))
      if (url.startsWith('/api/profile')) return Promise.resolve(jsonResponse(emptyProfile))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    const user = userEvent.setup()
    render(<CalorieCalculator onApplyGoal={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/using latest weight 75 kg/i)).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText(/^sex$/i), 'male')
    await user.clear(screen.getByLabelText(/^age/i))
    await user.type(screen.getByLabelText(/^age/i), '28')
    await user.clear(screen.getByLabelText(/^height/i))
    await user.type(screen.getByLabelText(/^height/i), '178')
    await user.selectOptions(screen.getByLabelText(/^activity level/i), 'moderately_active')

    await user.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) => url === '/api/profile' && (init as RequestInit)?.method === 'PATCH',
      )
      expect(patchCall).toBeDefined()
      const body = JSON.parse((patchCall![1] as RequestInit).body as string)
      expect(body).toMatchObject({ sex: 'male', age: 28, height_cm: 178, activity_level: 'moderately_active' })
    })
  })

  it('pre-fills form from saved profile on load', async () => {
    const savedProfile = {
      id: 1,
      age: 30,
      sex: 'female',
      height_cm: 165,
      activity_level: 'lightly_active',
      updated_at: '2026-05-25 12:00:00',
    }
    mockFetch(fetchMock, { weightEntries: [], profile: savedProfile })
    render(<CalorieCalculator onApplyGoal={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/^sex$/i)).toHaveValue('female')
    })
    expect(screen.getByLabelText(/^age/i)).toHaveValue(30)
    expect(screen.getByLabelText(/^height/i)).toHaveValue(165)
    expect(screen.getByLabelText(/^activity level/i)).toHaveValue('lightly_active')
  })
})
