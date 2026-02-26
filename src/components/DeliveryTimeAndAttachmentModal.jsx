import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Two-step modal: (1) Delivery time (Morning/Afternoon), (2) Add attachment (Original/Copy/None).
 * Use skipTimeStep=true for Salesman path (attachment only).
 */
export default function DeliveryTimeAndAttachmentModal({
  isOpen,
  dateLabel,
  skipTimeStep = false,
  onClose,
  onComplete,
}) {
  const [step, setStep] = useState(1)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [attachmentType, setAttachmentType] = useState('none')

  useEffect(() => {
    if (!isOpen) {
      setStep(skipTimeStep ? 2 : 1)
      setSelectedSlot(null)
      setAttachmentType('none')
    } else {
      setStep(skipTimeStep ? 2 : 1)
      setSelectedSlot(null)
      setAttachmentType('none')
    }
  }, [isOpen, skipTimeStep])

  if (!isOpen) return null

  const handleSlotSelect = (value) => {
    setSelectedSlot(value)
    setStep(2)
  }

  const handleAttachmentOk = () => {
    const slot = skipTimeStep ? null : selectedSlot
    onComplete({ slot, attachmentType })
    onClose()
  }

  const handleAttachmentCancel = () => {
    if (skipTimeStep) {
      onClose()
    } else if (step === 2) {
      setStep(1)
      setSelectedSlot(null)
      setAttachmentType('none')
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={handleAttachmentCancel}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {step === 1 ? 'Delivery time' : 'Add attachment'}
          </h3>
          <button
            type="button"
            onClick={handleAttachmentCancel}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {step === 1 ? (
          <>
            <p className="text-slate-600 text-sm mb-3">Date: {dateLabel}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSlotSelect('Morning')}
                className="flex-1 py-2.5 px-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Morning
              </button>
              <button
                type="button"
                onClick={() => handleSlotSelect('Afternoon')}
                className="flex-1 py-2.5 px-4 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
              >
                Afternoon
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-600 text-sm mb-4">Select one option:</p>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="attachmentType"
                  checked={attachmentType === 'original'}
                  onChange={() => setAttachmentType('original')}
                  className="border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-sm text-slate-700">Attach Original Invoice</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="attachmentType"
                  checked={attachmentType === 'copy'}
                  onChange={() => setAttachmentType('copy')}
                  className="border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-sm text-slate-700">Attach Copy Invoice</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="attachmentType"
                  checked={attachmentType === 'none'}
                  onChange={() => setAttachmentType('none')}
                  className="border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-sm text-slate-700">No Attachment</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleAttachmentCancel}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttachmentOk}
                className="px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium"
              >
                OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
