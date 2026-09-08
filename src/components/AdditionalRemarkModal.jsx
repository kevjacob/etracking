import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function AdditionalRemarkModal({ isOpen, initialRemark, onClose, onSave }) {
  const [remark, setRemark] = useState(initialRemark || '')

  useEffect(() => {
    setRemark(initialRemark || '')
  }, [isOpen, initialRemark])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(remark.trim())
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Additional Remark</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Remark</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              placeholder="Enter additional remark"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
