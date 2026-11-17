/**
 * Status transition history for Lead Time Aging Report.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'
import { fetchAllRows } from '../lib/fetchAllRows'

const STORAGE_KEY = 'etracking_status_history'

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveHistory(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save status history:', e)
  }
}

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

/** Whole calendar days between two ISO timestamps (e.g. 14 Aug → 17 Aug = 3). */
export function calcDaysElapsed(fromIso, toIso) {
  if (!fromIso || !toIso) return 0
  const from = new Date(fromIso)
  const to = new Date(toIso)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  from.setHours(0, 0, 0, 0)
  to.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
}

export async function insertStatusHistory(entry) {
  const fromStatusAt = entry.fromStatusAt || entry.toStatusAt || new Date().toISOString()
  const toStatusAt = entry.toStatusAt || new Date().toISOString()
  const row = {
    entityType: entry.entityType,
    entityId: String(entry.entityId),
    documentNo: entry.documentNo || '',
    fromStatus: entry.fromStatus ?? '',
    toStatus: entry.toStatus ?? '',
    fromStatusAt,
    toStatusAt,
    daysElapsed: calcDaysElapsed(fromStatusAt, toStatusAt),
    editedBy: String(entry.editedBy || '').trim(),
  }

  if (isSupabaseConfigured()) {
    const payload = toSnakeCase(row)
    let { data, error } = await supabase.from('status_history').insert(payload).select('*').single()
    if (error && isMissingEditedByColumn(error)) {
      const withoutEditor = { ...payload }
      delete withoutEditor.edited_by
      const retry = await supabase.from('status_history').insert(withoutEditor).select('*').single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    return fromSnakeCase(data)
  }

  const rows = loadHistory()
  const saved = { ...row, id: generateId(), createdAt: new Date().toISOString() }
  rows.push(saved)
  saveHistory(rows)
  return saved
}

function isMissingEditedByColumn(error) {
  const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`
  return /edited_by/i.test(msg)
}

/** Status updates for one document, oldest first. */
export async function fetchStatusHistoryForEntity(entityType, entityId) {
  const id = String(entityId ?? '')
  if (!entityType || !id) return []

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('status_history')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', id)
      .order('to_status_at', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(fromSnakeCase)
  }

  return loadHistory()
    .filter((r) => r.entityType === entityType && String(r.entityId) === id)
    .sort((a, b) => {
      const ta = new Date(a.toStatusAt).getTime()
      const tb = new Date(b.toStatusAt).getTime()
      if (ta !== tb) return ta - tb
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    })
}

export async function fetchStatusHistory(filters = {}) {
  const { entityType, fromStatus, toStatus, dateFrom, dateTo } = filters

  if (isSupabaseConfigured()) {
    const data = await fetchAllRows(() => {
      let query = supabase.from('status_history').select('*').order('to_status_at', { ascending: false })
      if (entityType) query = query.eq('entity_type', entityType)
      if (fromStatus) query = query.eq('from_status', fromStatus)
      if (toStatus) query = query.eq('to_status', toStatus)
      if (dateFrom) query = query.gte('to_status_at', `${dateFrom}T00:00:00`)
      if (dateTo) query = query.lte('to_status_at', `${dateTo}T23:59:59.999`)
      return query
    })
    return data.map(fromSnakeCase)
  }

  let rows = loadHistory()
  if (entityType) rows = rows.filter((r) => r.entityType === entityType)
  if (fromStatus) rows = rows.filter((r) => r.fromStatus === fromStatus)
  if (toStatus) rows = rows.filter((r) => r.toStatus === toStatus)
  if (dateFrom) {
    const fromMs = new Date(`${dateFrom}T00:00:00`).getTime()
    rows = rows.filter((r) => new Date(r.toStatusAt).getTime() >= fromMs)
  }
  if (dateTo) {
    const toMs = new Date(`${dateTo}T23:59:59.999`).getTime()
    rows = rows.filter((r) => new Date(r.toStatusAt).getTime() <= toMs)
  }
  return rows.sort((a, b) => new Date(b.toStatusAt) - new Date(a.toStatusAt))
}
