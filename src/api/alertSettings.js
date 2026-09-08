/**
 * Alert settings API. Uses direct table read/write (same pattern as invoices).
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { mergeAlertSettings, getDefaultAlertSettings } from '../utils/alertStatus'

const STORAGE_KEY = 'etracking_alert_settings'

function loadLocalSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultAlertSettings()
    return mergeAlertSettings(JSON.parse(raw))
  } catch {
    return getDefaultAlertSettings()
  }
}

function saveLocalSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save alert settings to localStorage:', e)
  }
}

function settingsToRows(settings) {
  return Object.entries(settings).map(([status_key, max_days]) => ({
    status_key,
    max_days,
  }))
}

export async function fetchAlertSettings() {
  if (!isSupabaseConfigured()) {
    return loadLocalSettings()
  }
  const { data, error } = await supabase
    .from('alert_settings')
    .select('status_key, max_days')
  if (error) throw error
  const stored = {}
  for (const row of data || []) {
    if (row?.status_key != null) stored[row.status_key] = row.max_days
  }
  return mergeAlertSettings(stored)
}

export async function saveAlertSettings(_adminUsername, settings) {
  const merged = mergeAlertSettings(settings)
  if (!isSupabaseConfigured()) {
    saveLocalSettings(merged)
    return merged
  }
  const rows = settingsToRows(merged)
  const { error } = await supabase
    .from('alert_settings')
    .upsert(rows, { onConflict: 'status_key' })
  if (error) throw error
  return merged
}
