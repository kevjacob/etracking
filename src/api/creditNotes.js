/**
 * Credit Notes. Uses Supabase when configured, else localStorage.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_credit_notes'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadCreditNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveCreditNotes(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save credit notes to localStorage:', e)
  }
}

export async function fetchCreditNotes() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('credit_notes').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadCreditNotes()
}

export async function insertCreditNote(row) {
  if (isSupabaseConfigured()) {
    const { id, ...rest } = row
    const payload = toSnakeCase(rest)
    const { data, error } = await supabase.from('credit_notes').insert(payload).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadCreditNotes()
  const newId = generateId()
  const newRow = { ...row, id: newId }
  rows.push(newRow)
  saveCreditNotes(rows)
  return newRow
}

export async function updateCreditNote(id, row) {
  if (isSupabaseConfigured()) {
    const payload = toSnakeCase({ ...row, id })
    const { data, error } = await supabase.from('credit_notes').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadCreditNotes()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveCreditNotes(rows)
  return updated
}

export async function deleteCreditNote(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('credit_notes').delete().eq('id', id)
    if (error) throw error
    return
  }
  const rows = loadCreditNotes().filter((r) => r.id !== id)
  saveCreditNotes(rows)
}
