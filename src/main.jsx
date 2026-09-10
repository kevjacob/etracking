import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MaintenanceModeProvider } from './context/MaintenanceModeContext'
import { TestModeProvider } from './context/TestModeContext'
import { AlertSettingsProvider } from './context/AlertSettingsContext'
import { EmployeesProvider } from './context/EmployeesContext'
import { WarehousesProvider } from './context/WarehousesContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <MaintenanceModeProvider>
          <TestModeProvider>
            <AlertSettingsProvider>
              <EmployeesProvider>
                <WarehousesProvider>
                  <App />
                </WarehousesProvider>
              </EmployeesProvider>
            </AlertSettingsProvider>
          </TestModeProvider>
        </MaintenanceModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
