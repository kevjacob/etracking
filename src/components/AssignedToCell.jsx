import { RefreshCw } from 'lucide-react'

export default function AssignedToCell({ name, showReassign, onReassign, reassignLabel = 'Reassign' }) {
  const isUnassigned = name === 'Unassigned' || name === '–'
  return (
    <span
      className={`py-1.5 px-2 flex items-center gap-1.5 min-w-[140px] ${
        isUnassigned ? 'text-slate-500' : 'text-slate-700'
      }`}
    >
      <span>{name}</span>
      {showReassign && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReassign?.()
          }}
          className="p-0.5 rounded text-slate-400 hover:text-blue-900 hover:bg-slate-100 shrink-0"
          title={reassignLabel}
          aria-label={`${reassignLabel} ${name}`}
        >
          <RefreshCw size={14} />
        </button>
      )}
    </span>
  )
}
