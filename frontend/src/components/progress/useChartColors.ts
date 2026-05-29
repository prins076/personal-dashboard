import { useTheme } from '../../hooks/useTheme'

export function useChartColors() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    grid: isDark ? '#374151' : '#eee',
    axis: isDark ? '#9ca3af' : '#6b7280',
    futureBar: isDark ? '#4b5563' : '#e5e7eb',
    tooltipStyle: isDark
      ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }
      : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' },
    tooltipItemStyle: isDark ? { color: '#f3f4f6' } : { color: '#111827' },
  }
}
