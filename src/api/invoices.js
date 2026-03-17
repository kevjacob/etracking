/**
 * Invoices (ESD). Uses Supabase when configured, else localStorage.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_invoices'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadInvoices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveInvoices(invoices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices))
  } catch (e) {
    console.error('Failed to save invoices to localStorage:', e)
  }
}

export async function fetchInvoices() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadInvoices()
}

export async function insertInvoice(row) {
  if (isSupabaseConfigured()) {
    const { id, ...rest } = row
    const payload = toSnakeCase(rest)
    const { data, error } = await supabase.from('invoices').insert(payload).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const invoices = loadInvoices()
  const newId = generateId()
  const newRow = { ...row, id: newId }
  invoices.push(newRow)
  saveInvoices(invoices)
  return newRow
}

export async function updateInvoice(id, row) {
  if (isSupabaseConfigured()) {
    const payload = toSnakeCase({ ...row, id })
    const { data, error } = await supabase.from('invoices').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const invoices = loadInvoices()
  const index = invoices.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...invoices[index], ...row, id }
  invoices[index] = updated
  saveInvoices(invoices)
  return updated
}

export async function deleteInvoice(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) throw error
    return
  }
  const invoices = loadInvoices().filter((r) => r.id !== id)
  saveInvoices(invoices)
}
