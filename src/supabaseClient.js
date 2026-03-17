import { createClient } from '@supabase/supabase-js'

const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Resolve API URL in the browser so the other PC (opening via host IP) uses that host for Supabase
function getSupabaseUrl() {
  if (typeof window === 'undefined') return envUrl
  if (!envUrl) return ''
  if (envUrl.startsWith('http://127.0.0.1:') || envUrl.startsWith('http://localhost:')) {
    const port = envUrl.replace(/^http:\/\/[^:]+/, '')
    return `http://${window.location.hostname}${port}`
  }
  return envUrl
}

export function isSupabaseConfigured() {
  const url = typeof window !== 'undefined' ? getSupabaseUrl() : envUrl
  return !!(url && supabaseAnonKey)
}

let client = null
function getClient() {
  if (client) return client
  const url = getSupabaseUrl()
  if (!url || !supabaseAnonKey) {
    if (envUrl) console.warn('Supabase not configured (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Using localStorage.')
    client = createClient('', '')
    return client
  }
  client = createClient(url, supabaseAnonKey)
  return client
}

// Lazy init so URL is resolved in the browser (window.location.hostname) when the other PC opens via host IP
export const supabase = new Proxy({}, { get(_, prop) { return getClient()[prop] } })
