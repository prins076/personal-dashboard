import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Nutrition from './pages/Nutrition'
import Exercise from './pages/Exercise'
import Progress from './pages/Progress'
import History from './pages/History'

type NavItem = { to: string; label: string; end?: boolean }

const NAV: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/exercise', label: 'Exercise' },
  { to: '/progress', label: 'Progress' },
  { to: '/history', label: 'History' },
]

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <nav className="mx-auto flex max-w-5xl gap-4 px-6 py-4 text-sm font-medium">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl">{children}</main>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/exercise" element={<Exercise />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
