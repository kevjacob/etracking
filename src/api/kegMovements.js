import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_keg_movements'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadMovements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveMovements(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save keg movements to localStorage:', e)
  }
}

function normalize(row) {
  return {
    ...row,
    items: Array.isArray(row?.items) ? row.items : [],
  }
}

export async function fetchKegMovements() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('keg_movements').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map((row) => normalize(fromSnakeCase(row)))
  }
  return loadMovements().map(normalize)
}

export async function insertKegMovement(row) {
  if (isSupabaseConfigured()) {
    const { id, ...rest } = row
    const { data, error } = await supabase.from('keg_movements').insert(toSnakeCase(rest)).select('*').single()
    if (error) throw error
    return normalize(fromSnakeCase(data))
  }
  const rows = loadMovements()
  const newRow = normalize({ ...row, id: generateId(), createdAt: new Date().toISOString() })
  rows.push(newRow)
  saveMovements(rows)
  return newRow
}

export async function updateKegMovement(id, row) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('keg_movements')
      .update(toSnakeCase({ ...row, id }))
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return normalize(fromSnakeCase(data))
  }
  const rows = loadMovements()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return normalize(row)
  const updated = normalize({ ...rows[index], ...row, id })
  rows[index] = updated
  saveMovements(rows)
  return updated
}

export async function deleteKegMovement(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('keg_movements').delete().eq('id', id)
    if (error) throw error
    return
  }
  saveMovements(loadMovements().filter((r) => r.id !== id))
}
