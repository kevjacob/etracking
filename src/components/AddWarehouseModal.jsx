import { useState } from 'react'
import { X } from 'lucide-react'
import { useWarehouses } from '../context/WarehousesContext'

export default function AddWarehouseModal({ isOpen, onClose, onSaved }) {
  const { addWarehouse } = useWarehouses()
  const [warehouseName, setWarehouseName] = useState('')
  const [picName, setPicName] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!warehouseName.trim()) return
    try {
      await addWarehouse(warehouseName.trim(), picName.trim())
      setWarehouseName('')
      setPicName('')
      onSaved?.()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  const handleClose = () => {
    setWarehouseName('')
    setPicName('')
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
          <h3 className="text-lg font-semibold text-slate-800">Add Warehouse</h3>
          <button type="button" onClick={handleClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse Name</label>
            <input
              type="text"
              value={warehouseName}
              onChange={(e) => setWarehouseName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Enter warehouse name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PIC Name</label>
            <input
              type="text"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Person in charge"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
