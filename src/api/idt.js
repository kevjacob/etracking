/**
 * IDT (Inter-Depot Transfer). Uses Supabase when configured, else localStorage.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const STORAGE_KEY = 'etracking_idt'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadIDTs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveIDTs(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save IDT to localStorage:', e)
  }
}

const defaultDiscrepancy = () => ({ checked: false, title: '', description: '' })

export function createIDTRow(overrides = {}) {
  return {
    id: String(Date.now() + Math.random()),
    idtNo: '',
    idtDate: '',
    fromWarehouseId: null,
    toWarehouseId: null,
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
    ...overrides,
  }
}

export async function fetchIDTs() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('idt').select('*').order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }
  return loadIDTs()
}

export async function insertIDT(row) {
  if (isSupabaseConfigured()) {
    const { id, ...rest } = row
    const payload = toSnakeCase(rest)
    const { data, error } = await supabase.from('idt').insert(payload).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadIDTs()
  const newId = generateId()
  const newRow = { ...row, id: newId }
  rows.push(newRow)
  saveIDTs(rows)
  return newRow
}

export async function updateIDT(id, row) {
  if (isSupabaseConfigured()) {
    const payload = toSnakeCase({ ...row, id })
    const { data, error } = await supabase.from('idt').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return fromSnakeCase(data)
  }
  const rows = loadIDTs()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveIDTs(rows)
  return updated
}

export async function deleteIDT(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('idt').delete().eq('id', id)
    if (error) throw error
    return
  }
  const rows = loadIDTs().filter((r) => r.id !== id)
  saveIDTs(rows)
}
