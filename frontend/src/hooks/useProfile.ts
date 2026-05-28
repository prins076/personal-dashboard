import { useEffect, useState } from 'react'
import { getProfile, patchProfile, type Profile, type ProfilePatch } from '../api/profile'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getProfile()
      .then((data) => {
        if (!cancelled) {
          setProfile(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function updateProfile(patch: ProfilePatch): Promise<Profile> {
    const updated = await patchProfile(patch)
    setProfile(updated)
    return updated
  }

  return { profile, updateProfile, loading }
}
