import { createContext, useContext, useState, useCallback } from 'react'

const DriversContext = createContext(null)

export function DriversProvider({ children }) {
  const [drivers, setDrivers] = useState([])

  const addDriver = useCallback((name, number) => {
    const id = String(Date.now())
    setDrivers((prev) => [...prev, { id, name, number }])
    return id
  }, [])

  const value = { drivers, addDriver }
  return (
    <DriversContext.Provider value={value}>
      {children}
    </DriversContext.Provider>
  )
}

export function useDrivers() {
  const ctx = useContext(DriversContext)
  if (!ctx) throw new Error('useDrivers must be used within DriversProvider')
  return ctx
}
