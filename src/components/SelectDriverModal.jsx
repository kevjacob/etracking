import { X, Truck } from 'lucide-react'
import { useEmployees } from '../context/EmployeesContext'

export default function SelectDriverModal({ isOpen, rowId, previousStatus, onClose, onSelect }) {
  const { employees } = useEmployees()
  const drivers = employees.filter((e) => e.position === 'Lorry Driver')

  const handleSelect = (driverId) => {
    onSelect(rowId, driverId)
  }

  const handleCancel = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Select Driver</h3>
          <button type="button" onClick={handleCancel} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {drivers.length === 0 ? (
            <p className="text-slate-500 text-sm">No drivers added. Add employees in Maintenance → Employee Maintenance.</p>
          ) : (
            <ul className="space-y-1">
              {drivers.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(d.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 text-left"
                  >
                    <Truck size={20} className="text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-800">{d.name}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-slate-200">
          <button type="button" onClick={handleCancel} className="w-full px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
