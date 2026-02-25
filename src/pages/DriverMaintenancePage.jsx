import { useState } from 'react'
import { Plus, User } from 'lucide-react'
import { useDrivers } from '../context/DriversContext'
import AddDriverModal from '../components/AddDriverModal'

export default function DriverMaintenancePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { drivers } = useDrivers()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium shadow"
        >
          <Plus size={18} />
          Add New Driver
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Drivers</h2>
        </div>
        {drivers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No drivers added yet. Click &quot;Add New Driver&quot; to add one.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {drivers.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <User size={18} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{d.name}</span>
                  <span className="text-slate-500 text-sm ml-2">{d.number}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddDriverModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {}}
      />
    </div>
  )
}
