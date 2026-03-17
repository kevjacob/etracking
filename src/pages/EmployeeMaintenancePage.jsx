import { useState, useMemo } from 'react'
import { Plus, UserCircle, Pencil } from 'lucide-react'
import { useEmployees } from '../context/EmployeesContext'
import AddEmployeeModal from '../components/AddEmployeeModal'

function groupByPosition(employees, positions) {
  const groups = Object.fromEntries(positions.map((p) => [p, []]))
  for (const e of employees) {
    const key = e.position in groups ? e.position : positions[0]
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
}

export default function EmployeeMaintenancePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const { employees, positions } = useEmployees()
  const byPosition = useMemo(() => groupByPosition(employees, positions), [employees, positions])

  const openEdit = (e) => {
    setEditingEmployee(e)
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditingEmployee(null)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => { setEditingEmployee(null); setModalOpen(true) }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium shadow"
        >
          <Plus size={18} />
          Add New Employee
        </button>
      </div>
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Employees</h2>
        </div>
        {employees.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No employees added yet. Click &quot;Add New Employee&quot; to add one.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {positions.map((position) => {
              const list = byPosition[position] || []
              if (list.length === 0) return null
              return (
                <div key={position}>
                  <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700">{position}</h3>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {list.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 group">
                        <UserCircle size={18} className="text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-slate-800">{e.name}</span>
                          {e.number && <span className="text-slate-500 text-sm ml-2">{e.number}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-900 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Edit employee"
                        >
                          <Pencil size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <AddEmployeeModal isOpen={modalOpen} onClose={closeModal} onSaved={() => {}} employee={editingEmployee} />
    </div>
  )
}
