import { Plus } from 'lucide-react'

export default function AnnouncementPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium shadow"
        >
          <Plus size={18} />
          Add Announcement
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Announcement Details</h2>
          <p className="text-sm text-slate-500 mt-1">Placeholder for announcement form and list</p>
        </div>
        <div className="p-8 min-h-[200px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-b-lg bg-slate-50/50">
          <p className="text-slate-400 text-sm">
            Placeholder area — add announcement form and content here later.
          </p>
        </div>
      </div>
    </div>
  )
}
