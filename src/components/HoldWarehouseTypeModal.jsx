import { X } from 'lucide-react'

export default function HoldWarehouseTypeModal({ isOpen, warehouseName, onClose, onSelect }) {
  const handleSelect = (type) => {
    onSelect(type)
    // Parent closes modal in handleHoldWarehouseTypeSelect; do not call onClose here or it runs cancel and reverts status to Billed
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {warehouseName ? `Hold - ${warehouseName} Warehouse` : 'Select type'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSelect('KIV')}
            className="flex-1 py-2.5 px-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium"
          >
            KIV
          </button>
          <button
            type="button"
            onClick={() => handleSelect('Self Collect')}
            className="flex-1 py-2.5 px-4 bg-slate-600 text-white rounded-lg hover:bg-slate-500 font-medium"
          >
            Self Collect
          </button>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
