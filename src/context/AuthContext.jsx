import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'

const STORAGE_KEY = 'etracking_user'

const AuthContext = createContext(null)

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveUser(user) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  else localStorage.removeItem(STORAGE_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    setUser(loadStoredUser())
    setAuthReady(true)
  }, [])

  const login = useCallback(async (username, password) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Cannot sign in.')
    }
    const { data, error } = await supabase.rpc('login', {
      p_username: username.trim(),
      p_password: password,
    })
    if (error) throw error
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null
    if (!row || !row.id) throw new Error('Invalid username or password')
    const userInfo = {
      id: row.id,
      username: username.trim(),
      name: row.name || '',
      position: row.position || 'Clerk',
      email: row.email || '',
      mobile: row.mobile ?? '',
      mustChangePassword: row.must_change_password === true,
    }
    setUser(userInfo)
    saveUser(userInfo)
    return userInfo
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!isSupabaseConfigured() || !user?.username) {
      throw new Error('Not signed in or Supabase not configured.')
    }
    const { error } = await supabase.rpc('change_password', {
      p_username: user.username,
      p_old_password: currentPassword,
      p_new_password: newPassword,
    })
    if (error) throw error
    const updated = { ...user, mustChangePassword: false }
    setUser(updated)
    saveUser(updated)
  }, [user])

  const updateProfile = useCallback(async (email, mobile) => {
    if (!isSupabaseConfigured() || !user?.username) {
      throw new Error('Not signed in or Supabase not configured.')
    }
    const { error } = await supabase.rpc('update_app_user_profile', {
      p_username: user.username,
      p_email: email ?? user.email ?? '',
      p_mobile: mobile ?? user.mobile ?? '',
    })
    if (error) throw error
    const updated = { ...user, email: email ?? user.email ?? '', mobile: mobile ?? user.mobile ?? '' }
    setUser(updated)
    saveUser(updated)
  }, [user])

  const setPassword = useCallback(async (newPassword) => {
    if (!isSupabaseConfigured() || !user?.username) {
      throw new Error('Not signed in or Supabase not configured.')
    }
    const { error } = await supabase.rpc('set_my_password', {
      p_username: user.username,
      p_new_password: newPassword,
    })
    if (error) throw error
    const updated = { ...user, mustChangePassword: false }
    setUser(updated)
    saveUser(updated)
  }, [user])

  const logout = useCallback(() => {
    setUser(null)
    saveUser(null)
  }, [])

  const isSuperuser = user?.position === 'Superuser'

  const value = {
    user,
    authReady,
    login,
    logout,
    changePassword,
    updateProfile,
    setPassword,
    isSuperuser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
