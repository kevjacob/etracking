import { RefreshCw } from 'lucide-react'

export default function RefreshListButton({ onRefresh, loading = false, label = 'Refresh list' }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={label}
      title={label}
    >
      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} aria-hidden />
      Refresh
    </button>
  )
}
