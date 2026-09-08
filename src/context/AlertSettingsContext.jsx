import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { fetchAlertSettings } from '../api/alertSettings'
import { getDefaultAlertSettings } from '../utils/alertStatus'

const AlertSettingsContext = createContext(null)

export function AlertSettingsProvider({ children }) {
  const [settings, setSettings] = useState(getDefaultAlertSettings())
  const [loading, setLoading] = useState(true)

  const reloadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchAlertSettings()
      setSettings(next)
    } catch (e) {
      console.error('Failed to load alert settings:', e)
      setSettings(getDefaultAlertSettings())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reloadSettings()
  }, [reloadSettings])

  return (
    <AlertSettingsContext.Provider value={{ settings, setSettings, reloadSettings, loading }}>
      {children}
    </AlertSettingsContext.Provider>
  )
}

export function useAlertSettings() {
  const ctx = useContext(AlertSettingsContext)
  if (!ctx) {
    throw new Error('useAlertSettings must be used within AlertSettingsProvider')
  }
  return ctx
}
