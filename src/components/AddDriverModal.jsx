import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useDrivers } from '../context/DriversContext'

export default function AddDriverModal({ isOpen, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const { addDriver } = useDrivers()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !number.trim()) return
    addDriver(name.trim(), number.trim())
    setName('')
    setNumber('')
    onSaved?.()
    onClose()
  }

  const handleClose = () => {
    setName('')
    setNumber('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Add New Driver</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="driver-name" className="block text-sm font-medium text-slate-700 mb-1">
              Driver Name
            </label>
            <input
              id="driver-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Enter driver name"
            />
          </div>
          <div>
            <label htmlFor="driver-number" className="block text-sm font-medium text-slate-700 mb-1">
              Driver Number
            </label>
            <input
              id="driver-number"
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="e.g. 60123456789"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
