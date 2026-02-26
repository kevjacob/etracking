import { Link, useLocation } from 'react-router-dom'
import { Home, FileText, Megaphone, BarChart3, Wrench, ChevronDown } from 'lucide-react'

const eTrackingItems = [
  { label: 'Invoice Tracking', path: '/etracking/invoice' },
  { label: 'Credit Note Tracking', path: '/etracking/credit-note' },
  { label: 'Delivery Order Tracking', path: '/etracking/delivery-order' },
  { label: 'GRN Tracking', path: '/etracking/grn' },
]

const reportItems = [
  { label: 'Invoice Tracking Report', path: null },
  { label: 'Credit Note Tracking Report', path: null },
  { label: 'Delivery Order Tracking Report', path: null },
]

const maintenanceItems = [
  { label: 'Employee Maintenance', path: '/maintenance/employee' },
  { label: 'Warehouse Maintenance', path: '/maintenance/warehouse' },
  { label: 'Import Document', path: null },
]

export default function NavBar() {
  const location = useLocation()

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
            {reportItems.map((item) => (
              <li key={item.label}>
                <span className="block px-5 py-2.5 text-slate-400 cursor-not-allowed text-sm">
                  {item.label}
                </span>
              </li>
            ))}
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
