import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import AnnouncementPage from './pages/AnnouncementPage'
import EmployeeMaintenancePage from './pages/EmployeeMaintenancePage'
import WarehouseMaintenancePage from './pages/WarehouseMaintenancePage'
import InvoiceTrackingPage from './pages/InvoiceTrackingPage'
import CreditNoteTrackingPage from './pages/CreditNoteTrackingPage'
import DeliveryOrderTrackingPage from './pages/DeliveryOrderTrackingPage'
import GRNTrackingPage from './pages/GRNTrackingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="announcement" element={<AnnouncementPage />} />
        <Route path="maintenance/employee" element={<EmployeeMaintenancePage />} />
        <Route path="maintenance/warehouse" element={<WarehouseMaintenancePage />} />
        <Route path="etracking/invoice" element={<InvoiceTrackingPage />} />
        <Route path="etracking/credit-note" element={<CreditNoteTrackingPage />} />
        <Route path="etracking/delivery-order" element={<DeliveryOrderTrackingPage />} />
        <Route path="etracking/grn" element={<GRNTrackingPage />} />
      </Route>
    </Routes>
  )
}
