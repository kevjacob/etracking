/**
 * Warehouses. Uses Supabase when configured, else localStorage.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { toSnakeCase, fromSnakeCase } from '../lib/dbMappers'

const WarehousesContext = createContext(null)

const STORAGE_KEY = 'etracking_warehouses'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadWarehouses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveWarehouses(warehouses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(warehouses))
  } catch (e) {
    console.error('Failed to save warehouses to localStorage:', e)
  }
}

function mapWarehouse(row) {
  if (!row) return null
  const r = fromSnakeCase(row)
  return {
    id: r.id,
    name: r.name || r.warehouse_name || '',
    picName: r.picName ?? r.pic_name ?? '',
    picPhone: r.picPhone ?? r.pic_phone ?? '',
  }
}

export function WarehousesProvider({ children }) {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWarehouses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('warehouses').select('*').order('name', { ascending: true })
        if (error) throw error
        setWarehouses((data || []).map(mapWarehouse))
      } else {
        const data = loadWarehouses()
        setWarehouses(data.map(mapWarehouse))
      }
    } catch (e) {
      setError(e.message)
      setWarehouses([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  const addWarehouse = useCallback(async (warehouseName, picName) => {
    if (isSupabaseConfigured()) {
      const payload = toSnakeCase({
        name: warehouseName ?? '',
        picName: picName ?? '',
        picPhone: '',
      })
      const { data, error } = await supabase.from('warehouses').insert(payload).select('*').single()
      if (error) throw error
      const mapped = mapWarehouse(data)
      setWarehouses((prev) => [mapped, ...prev])
      return mapped.id
    }
    const list = loadWarehouses()
    const newWarehouse = {
      id: generateId(),
      name: warehouseName ?? '',
      picName: picName ?? '',
      picPhone: '',
    }
    list.unshift(newWarehouse)
    saveWarehouses(list)
    setWarehouses((prev) => [mapWarehouse(newWarehouse), ...prev])
    return newWarehouse.id
  }, [])

  const updateWarehouse = useCallback(async (id, { name, picName, picPhone }) => {
    if (isSupabaseConfigured()) {
      const payload = toSnakeCase({
        name: name ?? '',
        picName: picName ?? '',
        picPhone: picPhone ?? '',
      })
      const { data, error } = await supabase.from('warehouses').update(payload).eq('id', id).select('*').single()
      if (error) throw error
      const mapped = mapWarehouse(data)
      setWarehouses((prev) => prev.map((w) => (w.id === id ? mapped : w)))
      return mapped.id
    }
    const list = loadWarehouses()
    const index = list.findIndex((w) => w.id === id)
    if (index === -1) return id
    const updated = { ...list[index], name: name ?? '', picName: picName ?? '', picPhone: picPhone ?? '' }
    list[index] = updated
    saveWarehouses(list)
    setWarehouses((prev) => prev.map((w) => (w.id === id ? mapWarehouse(updated) : w)))
    return id
  }, [])

  const value = { warehouses, addWarehouse, updateWarehouse, loading, error, refetch: fetchWarehouses }
  return (
    <WarehousesContext.Provider value={value}>
      {children}
    </WarehousesContext.Provider>
  )
}

export function useWarehouses() {
  const ctx = useContext(WarehousesContext)
  if (!ctx) throw new Error('useWarehouses must be used within WarehousesProvider')
  return ctx
}
