import { createPortal } from 'react-dom'

export default function InvoiceSearchModal({
  isOpen,
  query,
  onQueryChange,
  invoices,
  selectedIds,
  onToggleId,
  onCancel,
  onConfirm,
  onAddAnother,
}) {
  if (!isOpen) return null

  const q = (query || '').trim().toLowerCase()
  const filtered = !q
    ? invoices
    : invoices.filter((inv) => (inv.invoiceNo || '').toLowerCase().includes(q))
  const selectedSet = new Set(selectedIds || [])
  const selectedInvoices = invoices.filter((inv) => selectedSet.has(inv.id))
  const canConfirm = selectedInvoices.length > 0 || filtered.length === 1

  const labelFor = (inv) => inv?.invoiceNo || inv?.id || ''

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Search invoice</h3>
        <p className="text-slate-600 text-sm mb-3">
          Enter invoice number and select one or more invoices:
        </p>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="e.g. INV-001"
          className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 mb-3"
          aria-label="Invoice number search"
        />
        <div className="border border-slate-200 rounded overflow-auto flex-1 min-h-[120px] max-h-[200px] mb-4">
          {filtered.length === 0 ? (
            <div className="p-4 text-slate-500 text-sm text-center">
              {invoices.length === 0 ? 'No invoices in list.' : 'No match. Type to search.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const checked = selectedSet.has(inv.id)
                return (
                  <li key={inv.id}>
                    <label
                      className={`flex items-center gap-2 w-full py-2 px-3 text-sm cursor-pointer hover:bg-slate-50 ${
                        checked ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleId(inv.id)}
                        className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                      />
                      <span>{labelFor(inv)}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <p className="text-slate-500 text-xs mb-3">
          {selectedInvoices.length > 0
            ? `Selected (${selectedInvoices.length}): ${selectedInvoices.map(labelFor).join(', ')}`
            : filtered.length === 1
              ? `Will use: ${labelFor(filtered[0])}`
              : 'Select one or more invoices to confirm.'}
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          {onAddAnother && (
            <button
              type="button"
              onClick={onAddAnother}
              disabled={!canConfirm}
              className="px-4 py-2 border border-blue-900 text-blue-900 rounded-lg hover:bg-blue-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add another
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm selected
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function resolveSelectedInvoices(invoices, selectedIds, filtered) {
  const selected = (invoices || []).filter((inv) => (selectedIds || []).includes(inv.id))
  if (selected.length > 0) return selected
  if (filtered?.length === 1) return [filtered[0]]
  return []
}
