import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_keg_stock_entries'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveEntries(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save keg stock entries to localStorage:', e)
  }
}

export async function fetchKegStockEntries() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('keg_stock_entries').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadEntries()
}

export async function insertKegStockEntry(row) {
  if (isSupabaseConfigured()) {
    const { id, ...rest } = row
    const { data, error } = await supabase.from('keg_stock_entries').insert(toSnakeCase(rest)).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadEntries()
  const newRow = { ...row, id: generateId(), createdAt: new Date().toISOString() }
  rows.push(newRow)
  saveEntries(rows)
  return newRow
}

export async function deleteKegStockEntry(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('keg_stock_entries').delete().eq('id', id)
    if (error) throw error
    return
  }
  saveEntries(loadEntries().filter((r) => r.id !== id))
}
