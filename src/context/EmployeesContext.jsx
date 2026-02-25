import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const EMPLOYEE_POSITIONS = ['Salesman', 'Lorry Driver', 'Clerk']

const EmployeesContext = createContext(null)

function mapEmployee(row) {
  if (!row) return null
  return {
    id: row.id,
    position: row.position,
    name: row.name,
    number: row.number || '',
  }
}

export function EmployeesProvider({ children }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
    if (e) {
      setError(e.message)
      setEmployees([])
    } else {
      setEmployees((data || []).map(mapEmployee))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const addEmployee = useCallback(async (position, name) => {
    const { data, error: e } = await supabase
      .from('employees')
      .insert({ name, position })
      .select('id, position, name')
      .single()
    if (e) {
      console.error('Add employee error:', e)
      throw e
    }
    const newEmployee = mapEmployee(data)
    setEmployees((prev) => [newEmployee, ...prev])
    return newEmployee.id
  }, [])

  const value = { employees, addEmployee, positions: EMPLOYEE_POSITIONS, loading, error, refetch: fetchEmployees }
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
