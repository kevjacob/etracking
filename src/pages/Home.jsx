import { Link } from 'react-router-dom'
import { Megaphone } from 'lucide-react'

const sampleAnnouncements = [
  { id: 1, date: '2025-02-24', title: 'System maintenance scheduled for March 1st' },
  { id: 2, date: '2025-02-20', title: 'New eTracking features now available' },
  { id: 3, date: '2025-02-15', title: 'Holiday office closure notice' },
]

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
          <Megaphone size={20} className="text-blue-900" />
          <h2 className="text-lg font-semibold text-slate-800">Announcements</h2>
        </div>
        <ul className="divide-y divide-slate-200">
          {sampleAnnouncements.map((ann) => (
            <li key={ann.id} className="hover:bg-slate-50 transition-colors">
              <Link
                to="/announcement"
                className="flex items-baseline gap-4 px-5 py-3 block text-left"
              >
                <span className="text-slate-500 text-sm shrink-0 w-28">{ann.date}</span>
                <span className="text-blue-900 font-medium hover:underline">{ann.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
