import { createContext, useContext, useState, useCallback } from 'react'

const SalesmenContext = createContext(null)

export function SalesmenProvider({ children }) {
  const [salesmen, setSalesmen] = useState([])

  const addSalesman = useCallback((name, number) => {
    const id = String(Date.now())
    setSalesmen((prev) => [...prev, { id, name, number }])
    return id
  }, [])

  const value = { salesmen, addSalesman }
  return (
    <SalesmenContext.Provider value={value}>
      {children}
    </SalesmenContext.Provider>
  )
}

export function useSalesmen() {
  const ctx = useContext(SalesmenContext)
  if (!ctx) throw new Error('useSalesmen must be used within SalesmenProvider')
  return ctx
}
