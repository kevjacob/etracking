import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { validatePassword, getPasswordHint } from '../utils/passwordRules'

const PASSWORD_MAX_LENGTH = 64
import { Pencil, Trash2, X } from 'lucide-react'

const POSITIONS = ['Clerk', 'Salesman', 'Lorry Driver', 'Warehouse', 'Superuser']

export default function AccountManagementPage() {
  const navigate = useNavigate()
  const { user, isSuperuser, authReady } = useAuth()
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [showRegister, setShowRegister] = useState(false)
  const registerPasswordRef = useRef(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [position, setPosition] = useState('Clerk')
  const [email, setEmail] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerSuccess, setRegisterSuccess] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

  const [editUser, setEditUser] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPosition, setEditPosition] = useState('Clerk')
  const [editEmail, setEditEmail] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editNewPassword, setEditNewPassword] = useState('')
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [deleteUser, setDeleteUser] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

const loadUsers = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.username) return
    setUsersLoading(true)
    setListError('')
    try {
      const adminUsername = String(user.username).trim()
      const { data, error } = await supabase.rpc('list_app_users', {
        p_username: adminUsername,
      })
      if (error) throw error
      let list = []
      if (data != null) {
        if (Array.isArray(data)) list = data
        else if (typeof data === 'string') list = JSON.parse(data) || []
        else if (typeof data === 'object' && !Array.isArray(data)) list = Object.values(data)
      }
      setUsers(list)
    } catch (err) {
      setListError(err.message || 'Failed to load accounts.')
    } finally {
      setUsersLoading(false)
    }
  }, [user?.username])

  useEffect(() => {
    if (isSuperuser && user?.username) loadUsers()
  }, [isSuperuser, user?.username, loadUsers])

  useEffect(() => {
    if (authReady && user && !isSuperuser) {
      navigate('/', { replace: true })
    }
  }, [authReady, user, isSuperuser, navigate])

  if (!isSuperuser) {
    return null
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegisterError('')
    setRegisterSuccess('')
    if (!username.trim()) {
      setRegisterError('Username is required.')
      return
    }
    if (!name.trim()) {
      setRegisterError('Name is required.')
      return
    }
    if (!email.trim()) {
      setRegisterError('Email is required.')
      return
    }
    const password = registerPasswordRef.current?.value ?? ''
    const pwCheck = validatePassword(password)
    if (!pwCheck.ok) {
      setRegisterError(pwCheck.message)
      return
    }
    setRegisterLoading(true)
    try {
      const { data: newUserId, error: createError } = await supabase.rpc('create_app_user', {
        p_admin_username: user.username,
        p_new_username: username.trim(),
        p_new_password: password,
        p_new_name: name.trim(),
        p_new_position: position,
        p_new_email: email.trim(),
      })
      if (createError) throw createError
      const newUsername = username.trim()
      setRegisterSuccess(`Account "${newUsername}" created. User must change password on first login.`)
      setUsername('')
      if (registerPasswordRef.current) registerPasswordRef.current.value = ''
      setName('')
      setPosition('Clerk')
      setEmail('')
      setUsers((prev) => [
        ...prev,
        {
          id: newUserId,
          username: newUsername,
          name: name.trim(),
          position,
          email: email.trim(),
          mobile: '',
        },
      ])
      await loadUsers()
    } catch (err) {
      setRegisterError(err.message || 'Failed to create account.')
    } finally {
      setRegisterLoading(false)
    }
  }

  const openEdit = (u) => {
    setEditUser(u)
    setEditName(u.name ?? '')
    setEditPosition(u.position ?? 'Clerk')
    setEditEmail(u.email ?? '')
    setEditMobile(u.mobile ?? '')
    setEditNewPassword('')
    setEditError('')
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!editUser) return
    setEditError('')
    if (editNewPassword) {
      const pwCheck = validatePassword(editNewPassword)
      if (!pwCheck.ok) {
        setEditError(pwCheck.message)
        return
      }
    }
    setEditLoading(true)
    try {
      const { error: updateError } = await supabase.rpc('update_app_user_admin', {
        p_admin_username: user.username,
        p_email: editEmail.trim(),
        p_mobile: (editMobile ?? '').trim(),
        p_name: editName.trim(),
        p_position: editPosition || editUser.position,
        p_target_username: editUser.username,
      })
      if (updateError) throw updateError
      if (editNewPassword) {
        const { error: pwError } = await supabase.rpc('set_user_password_admin', {
          p_admin_username: user.username,
          p_target_username: editUser.username,
          p_new_password: editNewPassword,
        })
        if (pwError) throw pwError
      }
      setEditUser(null)
      loadUsers()
    } catch (err) {
      setEditError(err.message || 'Failed to update account.')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setDeleteLoading(true)
    try {
      const { error: deleteError } = await supabase.rpc('delete_app_user', {
        p_admin_username: user.username,
        p_target_username: deleteUser.username,
      })
      if (deleteError) throw deleteError
      setDeleteUser(null)
      loadUsers()
    } catch (err) {
      setEditError(err.message || 'Failed to delete account.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Account Management</h2>
        <button
          type="button"
          onClick={() => setShowRegister(!showRegister)}
          className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
        >
          {showRegister ? 'Cancel' : 'Register new account'}
        </button>
      </div>

      {showRegister && (
        <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-slate-700 mb-4">Register new account</h3>
          <p className="text-slate-500 text-xs mb-4">{getPasswordHint()}</p>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  ref={registerPasswordRef}
                  type="password"
                  name="register-password"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={PASSWORD_MAX_LENGTH}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  placeholder="At least 8 chars, 1 upper, 1 symbol, 1 number"
                  title="Include at least 1 uppercase letter, 1 symbol (e.g. @ ! #), and 1 number"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                placeholder="email@example.com"
              />
            </div>
            {registerError && <p className="text-sm text-red-600" role="alert">{registerError}</p>}
            {registerSuccess && <p className="text-sm text-green-600" role="status">{registerSuccess}</p>}
            <button
              type="submit"
              disabled={registerLoading}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
            >
              {registerLoading ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </section>
      )}

      <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-sm font-medium text-slate-700">Existing accounts</h3>
          <button
            type="button"
            onClick={() => loadUsers()}
            disabled={usersLoading}
            className="text-sm text-blue-900 hover:underline disabled:opacity-50"
          >
            {usersLoading ? 'Loading…' : 'Refresh list'}
          </button>
        </div>
        {listError && <p className="text-sm text-red-600 px-4 pb-2" role="alert">{listError}</p>}
        {usersLoading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No accounts yet. Register a new account above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Username</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Position</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Mobile</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-4 text-slate-800">{u.username}</td>
                    <td className="py-2 px-4 text-slate-700">{u.name}</td>
                    <td className="py-2 px-4 text-slate-700">{u.position}</td>
                    <td className="py-2 px-4 text-slate-700">{u.email}</td>
                    <td className="py-2 px-4 text-slate-700">{u.mobile || '—'}</td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded text-slate-600 hover:bg-slate-200"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteUser(u)}
                          disabled={u.username === user?.username}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Delete"
                          title={u.username === user?.username ? 'Cannot delete your own account' : 'Delete account'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800">Edit account: {editUser.username}</h3>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                <select
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile (optional)</label>
                <input
                  type="text"
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Set new password (optional)</label>
                <input
                  type="password"
                  inputMode="text"
                  autoComplete="new-password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  maxLength={PASSWORD_MAX_LENGTH}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  placeholder="Leave blank to keep current"
                />
                <p className="text-xs text-slate-500 mt-1">{getPasswordHint()}</p>
              </div>
              {editError && <p className="text-sm text-red-600" role="alert">{editError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
                >
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Delete account?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Permanently delete <strong>{deleteUser.username}</strong> ({deleteUser.name})? This cannot be undone.
            </p>
            {editError && <p className="text-sm text-red-600 mb-2" role="alert">{editError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteUser(null); setEditError('') }}
                disabled={deleteLoading}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
