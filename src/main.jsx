import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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
        <AlertSettingsProvider>
          <EmployeesProvider>
            <WarehousesProvider>
              <App />
            </WarehousesProvider>
          </EmployeesProvider>
        </AlertSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
