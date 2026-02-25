import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const WarehousesContext = createContext(null)

function mapWarehouse(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.warehouse_name || row.name || '',
    picName: row.pic_name || '',
    picPhone: row.pic_phone || '',
  }
}

export function WarehousesProvider({ children }) {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWarehouses = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('warehouses')
      .select('*')
      .order('created_at', { ascending: false })
    if (e) {
      setError(e.message)
      setWarehouses([])
    } else {
      setWarehouses((data || []).map(mapWarehouse))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  const addWarehouse = useCallback(async (warehouseName, picName) => {
    const payload = {
      warehouse_name: warehouseName ?? '',
      pic_name: picName ?? '',
    }
    const { data, error: e } = await supabase
      .from('warehouses')
      .insert(payload)
      .select('id, warehouse_name, pic_name')
      .single()
    if (e) {
      console.error('Add warehouse error:', e)
      throw e
    }
    const newWarehouse = mapWarehouse(data)
    setWarehouses((prev) => [newWarehouse, ...prev])
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
