import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validatePassword, getPasswordHint } from '../utils/passwordRules'

export default function ChangePasswordPage() {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/'

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!currentPassword) {
      setError('Enter your current (temporary) password.')
      return
    }
    const pwCheck = validatePassword(newPassword)
    if (!pwCheck.ok) {
      setError(pwCheck.message)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.')
      return
    }
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-lg shadow border border-slate-200 w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Change password</h2>
        <p className="text-slate-500 text-sm mb-6">
          {user?.mustChangePassword
            ? 'You signed in with a temporary password. Set your own password to continue.'
            : 'Enter your current password and choose a new password.'}
        </p>
        <p className="text-slate-500 text-xs mb-4">{getPasswordHint()}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current" className="block text-sm font-medium text-slate-700 mb-1">
              Current password {user?.mustChangePassword && '(temporary)'}
            </label>
            <input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={64}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label htmlFor="new" className="block text-sm font-medium text-slate-700 mb-1">
              New password
            </label>
            <input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={64}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="At least 8 chars, 1 upper, 1 symbol, 1 number"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={64}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Re-enter new password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
