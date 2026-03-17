import { Link, useLocation } from 'react-router-dom'
import { Home, FileText, Megaphone, BarChart3, Wrench, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const eTrackingItems = [
  { label: 'ESD Invoice Tracking', path: '/etracking/invoice' },
  { label: 'Autocount Invoice Tracking', path: '/etracking/autocount-invoice' },
  { label: 'Credit Note Tracking', path: '/etracking/credit-note' },
  { label: 'Delivery Order Tracking', path: '/etracking/delivery-order' },
  { label: 'GRN Tracking', path: '/etracking/grn' },
]

const reportItems = [
  { label: 'ESD Invoice Report', path: '/report/esd-invoice' },
  { label: 'AC Invoice Report', path: null },
  { label: 'Credit Note Report', path: null },
  { label: 'Delivery Order Report', path: null },
  { label: 'GRN Report', path: null },
]

const maintenanceItemsBase = [
  { label: 'Update Account', path: '/maintenance/update-account' },
  { label: 'Employee Maintenance', path: '/maintenance/employee' },
  { label: 'Warehouse Maintenance', path: '/maintenance/warehouse' },
  { label: 'JSON Import/Export', path: '/maintenance/json-import-export' },
  { label: 'Import Document', path: '/maintenance/import-document' },
]

export default function NavBar() {
  const location = useLocation()
  const { isSuperuser } = useAuth()
  const maintenanceItems = [
    ...(isSuperuser ? [{ label: 'Account Management', path: '/maintenance/account-management' }] : []),
    ...maintenanceItemsBase,
  ]

  return (
    <nav className="bg-slate-800 text-white shadow">
      <ul className="flex items-center gap-0">
        <li>
          <Link
            to="/"
            className={`flex items-center gap-2 px-5 py-3 hover:bg-slate-700 transition-colors ${
              location.pathname === '/' ? 'bg-slate-700' : ''
            }`}
          >
            <Home size={18} />
            Home
          </Link>
        </li>

        {/* Announcement: superuser only */}
        {isSuperuser && (
        <li>
          <Link
            to="/announcement"
            className={`flex items-center gap-2 px-5 py-3 hover:bg-slate-700 transition-colors ${
              location.pathname === '/announcement' ? 'bg-slate-700' : ''
            }`}
          >
            <Megaphone size={18} />
            Announcement
          </Link>
        </li>
        )}

        {/* eTracking dropdown */}
        <li className="group relative">
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-3 hover:bg-slate-700 transition-colors w-full"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <FileText size={18} />
            eTracking
            <ChevronDown size={16} className="opacity-80" />
          </button>
          <ul className="absolute left-0 top-full min-w-[220px] bg-slate-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 py-1">
            {eTrackingItems.map((item) =>
              item.path ? (
                <li key={item.label}>
                  <Link
                    to={item.path}
                    className={`block px-5 py-2.5 hover:bg-slate-600 text-sm ${
                      location.pathname === item.path ? 'bg-slate-600' : ''
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <span className="block px-5 py-2.5 text-slate-400 cursor-not-allowed text-sm">
                    {item.label}
                  </span>
                </li>
              )
            )}
          </ul>
        </li>

        {/* Report dropdown */}
        <li className="group relative">
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-3 hover:bg-slate-700 transition-colors w-full"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <BarChart3 size={18} />
            Report
            <ChevronDown size={16} className="opacity-80" />
          </button>
          <ul className="absolute left-0 top-full min-w-[260px] bg-slate-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 py-1">
            {reportItems.map((item) =>
              item.path ? (
                <li key={item.label}>
                  <Link
                    to={item.path}
                    className={`block px-5 py-2.5 hover:bg-slate-600 text-sm ${
                      location.pathname === item.path ? 'bg-slate-600' : ''
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <span className="block px-5 py-2.5 text-slate-400 cursor-not-allowed text-sm">
                    {item.label}
                  </span>
                </li>
              )
            )}
          </ul>
        </li>

        {/* Maintenance dropdown */}
        <li className="group relative">
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-3 hover:bg-slate-700 transition-colors w-full"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <Wrench size={18} />
            Maintenance
            <ChevronDown size={16} className="opacity-80" />
          </button>
          <ul className="absolute left-0 top-full min-w-[200px] bg-slate-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 py-1">
            {maintenanceItems.map((item) =>
              item.path ? (
                <li key={item.label}>
                  <Link
                    to={item.path}
                    className={`block px-5 py-2.5 hover:bg-slate-600 text-sm ${
                      location.pathname === item.path ? 'bg-slate-600' : ''
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <span className="block px-5 py-2.5 text-slate-400 cursor-not-allowed text-sm">
                    {item.label}
                  </span>
                </li>
              )
            )}
          </ul>
        </li>
      </ul>
    </nav>
  )
}
