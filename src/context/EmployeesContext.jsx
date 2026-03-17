/**
 * Employees. Uses Supabase when configured, else localStorage.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { fromSnakeCase } from '../lib/dbMappers'

const EMPLOYEE_POSITIONS = ['Salesman', 'Lorry Driver', 'Clerk']
const STORAGE_KEY = 'etracking_employees'

const EmployeesContext = createContext(null)

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadEmployees() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveEmployees(employees) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees))
  } catch (e) {
    console.error('Failed to save employees to localStorage:', e)
  }
}

function mapEmployee(row) {
  if (!row) return null
  const r = fromSnakeCase(row)
  return {
    id: r.id,
    position: r.position,
    name: r.name,
    number: r.number || '',
  }
}

export function EmployeesProvider({ children }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('employees').select('*').order('name', { ascending: true })
        if (error) throw error
        setEmployees((data || []).map(mapEmployee))
      } else {
        const data = loadEmployees()
        setEmployees(data.map(mapEmployee))
      }
    } catch (e) {
      setError(e.message)
      setEmployees([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const addEmployee = useCallback(async (position, name) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('employees')
        .insert({ position, name: name || '', number: '' })
        .select('*')
        .single()
      if (error) throw error
      const mapped = mapEmployee(data)
      setEmployees((prev) => [mapped, ...prev])
      return mapped.id
    }
    const list = loadEmployees()
    const newEmployee = {
      id: generateId(),
      position,
      name: name || '',
      number: '',
    }
    list.unshift(newEmployee)
    saveEmployees(list)
    setEmployees((prev) => [mapEmployee(newEmployee), ...prev])
    return newEmployee.id
  }, [])

  const updateEmployee = useCallback(async (id, { position, name, number }) => {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('employees')
        .update({ position, name: name ?? '', number: number ?? '' })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      const mapped = mapEmployee(data)
      setEmployees((prev) => prev.map((e) => (e.id === id ? mapped : e)))
      return mapped.id
    }
    const list = loadEmployees()
    const index = list.findIndex((e) => e.id === id)
    if (index === -1) return id
    const updated = { ...list[index], position, name: name ?? '', number: number ?? '' }
    list[index] = updated
    saveEmployees(list)
    setEmployees((prev) => prev.map((e) => (e.id === id ? mapEmployee(updated) : e)))
    return id
  }, [])

  const value = { employees, addEmployee, updateEmployee, positions: EMPLOYEE_POSITIONS, loading, error, refetch: fetchEmployees }
  return (
    <EmployeesContext.Provider value={value}>
      {children}
    </EmployeesContext.Provider>
  )
}

export function useEmployees() {
  const ctx = useContext(EmployeesContext)
  if (!ctx) throw new Error('useEmployees must be used within EmployeesProvider')
  return ctx
}

export { EMPLOYEE_POSITIONS }
