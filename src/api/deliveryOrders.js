/**
 * Delivery Orders. Uses Supabase when configured, else localStorage.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_delivery_orders'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadDeliveryOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveDeliveryOrders(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save delivery orders to localStorage:', e)
  }
}

export async function fetchDeliveryOrders() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('delivery_orders').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadDeliveryOrders()
}

export async function insertDeliveryOrder(row) {
  if (isSupabaseConfigured()) {
    const { id, ...rest } = row
    const payload = toSnakeCase(rest)
    const { data, error } = await supabase.from('delivery_orders').insert(payload).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadDeliveryOrders()
  const newId = generateId()
  const newRow = { ...row, id: newId }
  rows.push(newRow)
  saveDeliveryOrders(rows)
  return newRow
}

export async function updateDeliveryOrder(id, row) {
  if (isSupabaseConfigured()) {
    const payload = toSnakeCase({ ...row, id })
    const { data, error } = await supabase.from('delivery_orders').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadDeliveryOrders()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveDeliveryOrders(rows)
  return updated
}

export async function deleteDeliveryOrder(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('delivery_orders').delete().eq('id', id)
    if (error) throw error
    return
  }
  const rows = loadDeliveryOrders().filter((r) => r.id !== id)
  saveDeliveryOrders(rows)
}
