import { useMemo } from 'react'
import { searchInvoicesCombined } from '../utils/invoiceLinkSync'

export default function InvoiceAttachmentSearch({
  esdInvoices,
  autocountInvoices,
  query,
  onQueryChange,
  selected,
  onSelect,
}) {
  const q = String(query || '').trim()

  const results = useMemo(() => {
    if (!q) return []
    return searchInvoicesCombined(esdInvoices, autocountInvoices, query)
  }, [esdInvoices, autocountInvoices, query, q])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Attachment (Optional)</label>
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search ESD or Autocount invoice no."
        className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 text-sm"
      />
      {selected && (
        <p className="text-sm text-blue-900 bg-blue-50 border border-blue-100 rounded px-3 py-2">
          Selected: <span className="font-medium">{selected.invoiceNo}</span>
          <span className="text-slate-500 ml-2 text-xs">
            {selected._source === 'autocount' ? 'Autocount' : 'ESD'}
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="ml-2 text-slate-500 hover:text-slate-700 underline text-xs"
          >
            Clear
          </button>
        </p>
      )}
      {q && results.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
          No record found
        </p>
      )}
      {q && results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
          {results.map((inv) => {
            const isSelected = selected?.id === inv.id && selected?._source === inv._source
            return (
              <li key={`${inv._source}-${inv.id}`}>
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? null : inv)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                    isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700'
                  }`}
                >
                  {inv.invoiceNo}
                  <span className="text-slate-400 ml-2 text-xs">
                    {inv._source === 'autocount' ? 'Autocount' : 'ESD'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
