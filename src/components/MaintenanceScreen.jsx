import { Construction } from 'lucide-react'

export default function MaintenanceScreen() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-slate-100">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-slate-200 px-8 py-10 text-center">
        <Construction className="mx-auto text-amber-500 mb-4" size={48} strokeWidth={1.5} />
        <h2 className="text-xl font-semibold text-slate-800 mb-3">Under maintenance</h2>
        <p className="text-slate-600 leading-relaxed">
          The site is currently down for maintenance. Please check back again later.
        </p>
      </div>
    </div>
  )
}
