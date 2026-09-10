import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchMaintenanceMode, setMaintenanceMode } from '../api/maintenanceMode'
import { useAuth } from './AuthContext'
import { supabase, isSupabaseConfigured } from '../supabaseClient'

const MaintenanceModeContext = createContext(null)

export function MaintenanceModeProvider({ children }) {
  const { user, isSuperuser } = useAuth()
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceReady, setMaintenanceReady] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState('')

  const refreshMaintenanceMode = useCallback(async () => {
    const enabled = await fetchMaintenanceMode()
    setMaintenanceEnabled(enabled)
    return enabled
  }, [])

  useEffect(() => {
    let cancelled = false
    refreshMaintenanceMode()
      .catch((err) => {
        console.error('Failed to load maintenance mode:', err)
      })
      .finally(() => {
        if (!cancelled) setMaintenanceReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [refreshMaintenanceMode])

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const channel = supabase
      .channel('maintenance_mode')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'maintenance_mode' },
        (payload) => {
          setMaintenanceEnabled(payload.new?.enabled === true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const toggleMaintenanceMode = useCallback(async () => {
    if (!isSuperuser || !user?.username || toggling) return
    const next = !maintenanceEnabled
    setToggleError('')
    setToggling(true)
    try {
      await setMaintenanceMode(user.username, next)
      setMaintenanceEnabled(next)
    } catch (err) {
      console.error('Failed to toggle maintenance mode:', err)
      setToggleError(err.message || 'Could not update maintenance mode.')
    } finally {
      setToggling(false)
    }
  }, [isSuperuser, user?.username, toggling, maintenanceEnabled])

  const value = {
    maintenanceEnabled,
    maintenanceReady,
    toggling,
    toggleError,
    toggleMaintenanceMode,
    setMaintenanceEnabled,
  }

  return (
    <MaintenanceModeContext.Provider value={value}>
      {children}
    </MaintenanceModeContext.Provider>
  )
}

export function useMaintenanceMode() {
  const ctx = useContext(MaintenanceModeContext)
  if (!ctx) throw new Error('useMaintenanceMode must be used within MaintenanceModeProvider')
  return ctx
}
