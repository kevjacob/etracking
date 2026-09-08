export default function RemoveSelfCollectModal({ isOpen, onYes, onNo }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={onNo}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Remove Self Collect?</h3>
        <p className="text-slate-600 text-sm mb-4">
          This remark includes Self Collect. Remove it before adding Chop &amp; Sign?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onNo}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            No, keep it
          </button>
          <button
            type="button"
            onClick={onYes}
            className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
          >
            Yes, remove
          </button>
        </div>
      </div>
    </div>
  )
}
