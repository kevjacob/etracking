import { Pencil } from 'lucide-react'
import { getAdditionalRemarkText, hasAdditionalRemark } from '../utils/additionalRemark'

export default function AdditionalRemarkCell({ discrepancy, canEdit, onEdit }) {
  const text = getAdditionalRemarkText(discrepancy)
  const hasRemark = hasAdditionalRemark(discrepancy)

  if (!canEdit) {
    return (
      <span className={`max-w-[160px] truncate block ${hasRemark ? 'text-slate-700' : 'text-slate-500'}`} title={text || undefined}>
        {hasRemark ? text : '–'}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={onEdit}
        className="p-1.5 rounded text-slate-600 hover:bg-slate-100 shrink-0"
        title="Edit additional remark"
        aria-label="Edit additional remark"
      >
        <Pencil size={18} />
      </button>
      {hasRemark ? (
        <span className="max-w-[140px] truncate text-slate-700" title={text}>
          {text}
        </span>
      ) : (
        <span className="text-slate-500 text-xs">–</span>
      )}
    </div>
  )
}
