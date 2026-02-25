import { useState } from 'react'
import { X } from 'lucide-react'

export default function DeliverySlotModal({ isOpen, dateLabel, onClose, onSelect }) {
  const [slot, setSlot] = useState(null)

  const handleConfirm = (value) => {
    setSlot(value)
    onSelect(value)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Delivery time</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-slate-600 text-sm mb-3">Date: {dateLabel}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleConfirm('Morning')}
            className="flex-1 py-2.5 px-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
          >
            Morning
          </button>
          <button
            type="button"
            onClick={() => handleConfirm('Afternoon')}
            className="flex-1 py-2.5 px-4 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
          >
            Afternoon
          </button>
        </div>
      </div>
    </div>
  )
}
