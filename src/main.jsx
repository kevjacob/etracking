import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { EmployeesProvider } from './context/EmployeesContext'
import { WarehousesProvider } from './context/WarehousesContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <EmployeesProvider>
        <WarehousesProvider>
          <App />
        </WarehousesProvider>
      </EmployeesProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
