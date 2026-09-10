import { supabase, isSupabaseConfigured } from '../supabaseClient'

const STORAGE_KEY = 'etracking_maintenance_mode'

function loadLocalMaintenanceMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveLocalMaintenanceMode(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
  } catch (e) {
    console.error('Failed to save maintenance mode to localStorage:', e)
  }
}

export async function fetchMaintenanceMode() {
  if (!isSupabaseConfigured()) {
    return loadLocalMaintenanceMode()
  }
  const { data, error } = await supabase
    .from('maintenance_mode')
    .select('enabled')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data?.enabled === true
}

export async function setMaintenanceMode(adminUsername, enabled) {
  if (!isSupabaseConfigured()) {
    saveLocalMaintenanceMode(enabled)
    return enabled
  }
  const { error } = await supabase.rpc('set_maintenance_mode', {
    p_enabled: enabled,
    p_username: adminUsername,
  })
  if (error) throw error
  return enabled
}
