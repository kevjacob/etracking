import { formatMonthLabel } from '../utils/trackingListFilters'

export default function TrackingMonthFilter({
  id,
  label = 'Current Month',
  availableMonths,
  value,
  onChange,
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 whitespace-nowrap">
        {label}:
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={availableMonths.length === 0}
        className="py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900 text-sm min-w-[10rem] disabled:bg-slate-50 disabled:text-slate-400"
        aria-label={`${label} filter`}
      >
        {availableMonths.length === 0 ? (
          <option value="">No months</option>
        ) : (
          availableMonths.map((monthKey) => (
            <option key={monthKey} value={monthKey}>
              {formatMonthLabel(monthKey)}
            </option>
          ))
        )}
      </select>
    </div>
  )
}
