import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { validatePassword, getPasswordHint } from '../utils/passwordRules'

export default function UpdateAccountPage() {
  const { user, updateProfile, setPassword } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [mobile, setMobile] = useState(user?.mobile ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    setEmail(user?.email ?? '')
    setMobile(user?.mobile ?? '')
  }, [user?.email, user?.mobile])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')
    setProfileSaving(true)
    try {
      await updateProfile(email, mobile)
      setProfileSuccess('Profile updated.')
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    const pwCheck = validatePassword(newPassword)
    if (!pwCheck.ok) {
      setPasswordError(pwCheck.message)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    setPasswordSaving(true)
    try {
      await setPassword(newPassword)
      setPasswordSuccess('Password updated.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto">
        <p className="text-slate-600">You must be signed in to update your account.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h2 className="text-lg font-semibold text-slate-800">Update Account</h2>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-medium text-slate-700 mb-4">Profile</h3>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={user.name}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
            <input
              type="text"
              value={user.position}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile number (optional)</label>
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Mobile number"
            />
          </div>
          {profileError && <p className="text-sm text-red-600" role="alert">{profileError}</p>}
          {profileSuccess && <p className="text-sm text-green-600" role="status">{profileSuccess}</p>}
          <button
            type="submit"
            disabled={profileSaving}
            className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
          >
            {profileSaving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Change password</h3>
        <p className="text-slate-500 text-xs mb-4">{getPasswordHint()}</p>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={64}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="At least 8 chars, 1 upper, 1 symbol, 1 number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              maxLength={64}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Re-enter new password"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600" role="alert">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-600" role="status">{passwordSuccess}</p>}
          <button
            type="submit"
            disabled={passwordSaving}
            className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
          >
            {passwordSaving ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  )
}
