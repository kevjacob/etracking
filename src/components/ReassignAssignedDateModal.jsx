import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { formatDate, toInputDate } from '../utils/dateFormat'

function getTodayDateStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function toUiSlot(slot) {
  if (slot === 'Noon') return 'Afternoon'
  if (slot === 'Morning' || slot === 'Afternoon') return slot
  return ''
}

export function reassignDateUpdates(date, slot) {
  return {
    deliveryDate: date,
    deliverySlot: slot === 'Afternoon' ? 'Noon' : slot,
  }
}

export default function ReassignAssignedDateModal({
  isOpen,
  currentLabel,
  initialDate,
  initialSlot,
  onClose,
  onConfirm,
}) {
  const [step, setStep] = useState('form')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setStep('form')
    setSelectedDate(toInputDate(initialDate) || getTodayDateStr())
    setSelectedSlot(toUiSlot(initialSlot))
  }, [isOpen, initialDate, initialSlot])

  if (!isOpen) return null

  const newLabel = selectedDate
    ? `${formatDate(selectedDate)}${selectedSlot ? ` - ${selectedSlot}` : ''}`
    : ''

  const handleOk = () => {
    if (!selectedDate || !selectedSlot) return
    setStep('confirm')
  }

  const handleYes = () => {
    if (!selectedDate || !selectedSlot) return
    onConfirm({ date: selectedDate, slot: selectedSlot })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'form' && (
          <>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Reassign date</h3>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || getTodayDateStr())}
                  className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                  aria-label="Choose new assigned date"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Morning or Afternoon</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSlot('Morning')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium ${
                      selectedSlot === 'Morning'
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Morning
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlot('Afternoon')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium ${
                      selectedSlot === 'Afternoon'
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Afternoon
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOk}
                disabled={!selectedDate || !selectedSlot}
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
                Reassign <span className="font-medium">{currentLabel || '–'}</span> to{' '}
                <span className="font-medium">{newLabel}</span>?
              </p>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setStep('form')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
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
