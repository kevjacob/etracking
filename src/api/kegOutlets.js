import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_keg_outlets'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadOutlets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveOutlets(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save keg outlets to localStorage:', e)
  }
}

export async function fetchKegOutlets() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('keg_outlets').select('*').order('name', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadOutlets().slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
}

export async function insertKegOutlet(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) throw new Error('Outlet name is required.')
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('keg_outlets')
      .insert(toSnakeCase({ name: trimmed }))
      .select('*')
      .single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadOutlets()
  const exists = rows.find((r) => String(r.name || '').trim().toLowerCase() === trimmed.toLowerCase())
  if (exists) return exists
  const row = { id: generateId(), name: trimmed, createdAt: new Date().toISOString() }
  rows.push(row)
  saveOutlets(rows)
  return row
}
