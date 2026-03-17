import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, authReady } = useAuth()
  const location = useLocation()
  const pathname = location.pathname
  const returnTo = pathname + location.search

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'} replace />
  }

  if (user.mustChangePassword && pathname !== '/change-password') {
    return <Navigate to={`/change-password?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  return children
}
