import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const STORAGE_PREFIX = 'etracking_month_filter_'

function getStorageKey(pageKey, userId) {
  return `${STORAGE_PREFIX}${pageKey}_${userId || 'anonymous'}`
}

function readStoredMonth(pageKey, userId) {
  try {
    return localStorage.getItem(getStorageKey(pageKey, userId)) || ''
  } catch {
    return ''
  }
}

/** Per-user, per-page month selection persisted in localStorage. */
export function useUserMonthFilter(pageKey) {
  const { user } = useAuth()
  const userId = user?.id || user?.username || 'anonymous'

  const [selectedMonth, setSelectedMonthState] = useState(() => readStoredMonth(pageKey, userId))

  useEffect(() => {
    setSelectedMonthState(readStoredMonth(pageKey, userId))
  }, [pageKey, userId])

  const setSelectedMonth = useCallback(
    (monthKey) => {
      setSelectedMonthState(monthKey)
      try {
        const key = getStorageKey(pageKey, userId)
        if (monthKey) localStorage.setItem(key, monthKey)
        else localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
    [pageKey, userId]
  )

  return { selectedMonth, setSelectedMonth }
}
