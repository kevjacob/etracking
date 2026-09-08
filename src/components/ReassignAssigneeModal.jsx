import { useEffect, useState } from 'react'
import { Truck, UserCircle, X } from 'lucide-react'
import { useEmployees } from '../context/EmployeesContext'

export function reassignAssigneeUpdates(type, personId) {
  if (type === 'salesman') {
    return { assignedSalesmanId: personId, assignedDriverId: null }
  }
  return { assignedDriverId: personId, assignedSalesmanId: null }
}

export default function ReassignAssigneeModal({ isOpen, currentName, onClose, onConfirm }) {
  const { employees } = useEmployees()
  const salesmen = employees.filter((e) => e.position === 'Salesman')
  const drivers = employees.filter((e) => e.position === 'Lorry Driver')
  const [step, setStep] = useState('role')
  const [role, setRole] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setStep('role')
    setRole(null)
    setSelectedId(null)
  }, [isOpen])

  if (!isOpen) return null

  const people = role === 'salesman' ? salesmen : drivers
  const selected = people.find((p) => p.id === selectedId)
  const newName = selected?.name || ''
  const emptyMessage =
    role === 'salesman'
      ? 'No salesmen added. Add employees in Maintenance → Employee Maintenance.'
      : 'No drivers added. Add employees in Maintenance → Employee Maintenance.'

  const handleRoleSelect = (nextRole) => {
    setRole(nextRole)
    setSelectedId(null)
    setStep('list')
  }

  const handleOk = () => {
    if (!selected) return
    setStep('confirm')
  }

  const handleYes = () => {
    if (!role || !selected) return
    onConfirm({ type: role, personId: selected.id, name: selected.name })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'role' && (
          <>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Reassign</h3>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm mb-4">Select Salesman or Driver</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleSelect('salesman')}
                  className="flex-1 py-2.5 px-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium"
                >
                  Salesman
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSelect('driver')}
                  className="flex-1 py-2.5 px-4 bg-slate-600 text-white rounded-lg hover:bg-slate-500 font-medium"
                >
                  Driver
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200">
              <button type="button" onClick={onClose} className="w-full px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'list' && (
          <>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                {role === 'salesman' ? 'Select Salesman' : 'Select Driver'}
              </h3>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {people.length === 0 ? (
                <p className="text-slate-500 text-sm">{emptyMessage}</p>
              ) : (
                <ul className="space-y-1">
                  {people.map((person) => {
                    const Icon = role === 'salesman' ? UserCircle : Truck
                    const isSelected = selectedId === person.id
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(person.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left ${
                            isSelected ? 'bg-blue-50 ring-1 ring-blue-900' : 'hover:bg-slate-100'
                          }`}
                        >
                          <Icon size={20} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800">{person.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('role')
                  setSelectedId(null)
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleOk}
                disabled={!selected}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Confirm reassign</h3>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-700">
                Reassign <span className="font-medium">{currentName || 'Unassigned'}</span> to{' '}
                <span className="font-medium">{newName}</span>?
              </p>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep('list')}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                No
              </button>
              <button type="button" onClick={handleYes} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">
                Yes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
