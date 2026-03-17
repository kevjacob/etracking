import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import AnnouncementPage from './pages/AnnouncementPage'
import EmployeeMaintenancePage from './pages/EmployeeMaintenancePage'
import WarehouseMaintenancePage from './pages/WarehouseMaintenancePage'
import AccountManagementPage from './pages/AccountManagementPage'
import UpdateAccountPage from './pages/UpdateAccountPage'
import JsonImportExportPage from './pages/JsonImportExportPage'
import ImportDocumentPage from './pages/ImportDocumentPage'
import ESDInvoiceTrackingPage from './pages/ESDInvoiceTrackingPage'
import AutocountInvoiceTrackingPage from './pages/AutocountInvoiceTrackingPage'
import CreditNoteTrackingPage from './pages/CreditNoteTrackingPage'
import DeliveryOrderTrackingPage from './pages/DeliveryOrderTrackingPage'
import GRNTrackingPage from './pages/GRNTrackingPage'
import ESDInvoiceReportPage from './pages/ESDInvoiceReportPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Home />} />
        <Route path="announcement" element={<AnnouncementPage />} />
        <Route path="maintenance/employee" element={<EmployeeMaintenancePage />} />
        <Route path="maintenance/warehouse" element={<WarehouseMaintenancePage />} />
        <Route path="maintenance/account-management" element={<AccountManagementPage />} />
        <Route path="maintenance/update-account" element={<UpdateAccountPage />} />
        <Route path="maintenance/json-import-export" element={<JsonImportExportPage />} />
        <Route path="maintenance/import-document" element={<ImportDocumentPage />} />
        <Route path="etracking/invoice" element={<ESDInvoiceTrackingPage />} />
        <Route path="etracking/autocount-invoice" element={<AutocountInvoiceTrackingPage />} />
        <Route path="etracking/credit-note" element={<CreditNoteTrackingPage />} />
        <Route path="etracking/delivery-order" element={<DeliveryOrderTrackingPage />} />
        <Route path="etracking/grn" element={<GRNTrackingPage />} />
        <Route path="report/esd-invoice" element={<ESDInvoiceReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
