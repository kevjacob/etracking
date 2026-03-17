/**
 * GRN (Goods Received Note). Uses Supabase when configured, else localStorage.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_grn'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadGRNs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveGRNs(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save GRN to localStorage:', e)
  }
}

export async function fetchGRNs() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('grn').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadGRNs()
}

export async function insertGRN(row) {
  if (isSupabaseConfigured()) {
    const { id, ...rest } = row
    const payload = toSnakeCase(rest)
    const { data, error } = await supabase.from('grn').insert(payload).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadGRNs()
  const newId = generateId()
  const newRow = { ...row, id: newId }
  rows.push(newRow)
  saveGRNs(rows)
  return newRow
}

export async function updateGRN(id, row) {
  if (isSupabaseConfigured()) {
    const payload = toSnakeCase({ ...row, id })
    const { data, error } = await supabase.from('grn').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadGRNs()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveGRNs(rows)
  return updated
}

export async function deleteGRN(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('grn').delete().eq('id', id)
    if (error) throw error
    return
  }
  const rows = loadGRNs().filter((r) => r.id !== id)
  saveGRNs(rows)
}
