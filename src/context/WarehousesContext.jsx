/**
 * Local-only storage for warehouses. All data saved in localStorage on this machine.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

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
  return {
    id: row.id,
    name: row.name || row.warehouse_name || '',
    picName: row.picName ?? row.pic_name ?? '',
    picPhone: row.picPhone ?? row.pic_phone ?? '',
  }
}

export function WarehousesProvider({ children }) {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWarehouses = useCallback(() => {
    setLoading(true)
    setError(null)
    try {
      const data = loadWarehouses()
      setWarehouses(data.map(mapWarehouse))
    } catch (e) {
      setError(e.message)
      setWarehouses([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  const addWarehouse = useCallback((warehouseName, picName) => {
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

  const value = { warehouses, addWarehouse, loading, error, refetch: fetchWarehouses }
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
