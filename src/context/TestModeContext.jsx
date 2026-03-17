import { createContext, useContext, useState } from 'react'

const TestModeContext = createContext(null)

export function TestModeProvider({ children }) {
  const [testMode, setTestMode] = useState(false)
  return (
    <TestModeContext.Provider value={{ testMode, setTestMode }}>
      {children}
    </TestModeContext.Provider>
  )
}

export function useTestMode() {
  const ctx = useContext(TestModeContext)
  if (!ctx) throw new Error('useTestMode must be used within TestModeProvider')
  return ctx
}
