/**
 * Shared logic for "on alert" (status exceeded allowed duration).
 * Used by Home page alert boxes and tracking pages.
 */
import { TRACKING_STATUS_OPTIONS, COD_ALERT_SETTING_KEY } from '../constants/trackingStatuses'

/** Default alert periods (days) before a row appears on alert. */
export function getDefaultAlertSettings() {
  return {
    Billed: 1,
    'Preparing Delivery': 3,
    'Delivery In Progress': 1.5,
    Delivered: 1,
    'Hold - Office': 4,
    'Hold - Warehouse': 4,
    'Hold - Salesman': 4,
    'Chop & Sign - Office': 4,
    'Chop & Sign - Warehouse': 4,
    'Chop & Sign - Salesman': 4,
    Transfer: 4,
    Completed: 1,
    Cancelled: 999,
    [COD_ALERT_SETTING_KEY]: 1,
  }
}

export function mergeAlertSettings(stored) {
  const defaults = getDefaultAlertSettings()
  if (!stored || typeof stored !== 'object') return { ...defaults }
  const merged = { ...defaults }
  for (const [key, value] of Object.entries(stored)) {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) continue
    merged[key] = n
  }
  return merged
}

export function getAlertPeriodDays(key, settings) {
  const merged = mergeAlertSettings(settings)
  const days = merged[key]
  return Number.isFinite(days) ? days : 1
}

export function isStatusOverdue(row, settings) {
  const updatedAt = row?.statusUpdatedAt
  if (!updatedAt) return false
  const maxDays = getAlertPeriodDays(row.status, settings)
  if (maxDays === 0 || maxDays >= 999) return false
  const updated = new Date(updatedAt).getTime()
  const now = Date.now()
  const maxMs = maxDays * 24 * 60 * 60 * 1000
  return now - updated > maxMs
}

export function isCodOverdue(row, settings) {
  if (!row?.cod) return false
  if (row.status === 'Completed' || row.status === 'Cancelled') return false
  const maxDays = getAlertPeriodDays(COD_ALERT_SETTING_KEY, settings)
  if (maxDays === 0) return false
  const updatedAt = row?.statusUpdatedAt
  if (!updatedAt) return false
  const updated = new Date(updatedAt).getTime()
  const now = Date.now()
  const maxMs = maxDays * 24 * 60 * 60 * 1000
  return now - updated > maxMs
}

export { TRACKING_STATUS_OPTIONS, COD_ALERT_SETTING_KEY }
