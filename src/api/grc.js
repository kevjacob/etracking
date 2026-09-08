/**
 * GRC (Goods Return Certificate). Uses Supabase when configured, else localStorage.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_grc'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadGRCs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveGRCs(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save GRC to localStorage:', e)
  }
}

const defaultDiscrepancy = () => ({ checked: false, title: '', description: '' })

export function createGRCRow(overrides = {}) {
  return {
    id: String(Date.now() + Math.random()),
    grcNo: '',
    grcDate: '',
    numberAndDateLocked: false,
    status: 'Billed',
    statusUpdatedAt: new Date().toISOString(),
    assignedDriverId: null,
    assignedSalesmanId: null,
    assignedClerkId: null,
    transferWarehouseId: null,
    holdWarehouseId: null,
    holdWarehouseType: '',
    deliveryDate: '',
    deliverySlot: '',
    remark: '',
    remarkAtBilled: '',
    discrepancy: defaultDiscrepancy(),
    outlet: '',
    linkedGrnId: null,
    ...overrides,
  }
}

export async function fetchGRCs() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('grc').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadGRCs()
}

export async function insertGRC(row) {
  if (isSupabaseConfigured()) {
    const { id, linkedGrcId, linkedGrnId, ...rest } = row
    const payload = toSnakeCase(rest)
    const { data, error } = await supabase.from('grc').insert(payload).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadGRCs()
  const newId = generateId()
  const newRow = { ...row, id: newId }
  rows.push(newRow)
  saveGRCs(rows)
  return newRow
}

export async function updateGRC(id, row) {
  if (isSupabaseConfigured()) {
    const { linkedGrcId, linkedGrnId, ...rest } = row
    const payload = toSnakeCase({ ...rest, id })
    const { data, error } = await supabase.from('grc').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadGRCs()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveGRCs(rows)
  return updated
}

export async function deleteGRC(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('grc').delete().eq('id', id)
    if (error) throw error
    return
  }
  const rows = loadGRCs().filter((r) => r.id !== id)
  saveGRCs(rows)
}
