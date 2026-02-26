/**
 * Local-only storage for employees. All data saved in localStorage on this machine.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

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

  const fetchEmployees = useCallback(() => {
    setLoading(true)
    setError(null)
    try {
      const data = loadEmployees()
      setEmployees(data.map(mapEmployee))
    } catch (e) {
      setError(e.message)
      setEmployees([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const addEmployee = useCallback((position, name) => {
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
