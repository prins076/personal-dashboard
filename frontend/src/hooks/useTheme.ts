import { useContext } from 'react'
import { ThemeContext } from './ThemeContext'

export type { Theme, ThemeContextValue } from './ThemeContext'
export { ThemeProvider } from './ThemeContext'

export function useTheme() {
  return useContext(ThemeContext)
}
