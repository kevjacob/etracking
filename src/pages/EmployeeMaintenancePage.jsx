import { useState } from 'react'
import { Plus, UserCircle } from 'lucide-react'
import { useEmployees } from '../context/EmployeesContext'
import AddEmployeeModal from '../components/AddEmployeeModal'

export default function EmployeeMaintenancePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { employees } = useEmployees()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
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
          <ul className="divide-y divide-slate-200">
            {employees.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <UserCircle size={18} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{e.name}</span>
                  <span className="text-slate-400 text-sm ml-2">({e.position})</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AddEmployeeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => {}} />
    </div>
  )
}
