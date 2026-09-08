import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { fetchStatusHistory } from '../api/statusHistory'
import { STATUS_HISTORY_ENTITY_TYPES, LEAD_TIME_BUCKETS, bucketForDays } from '../constants/statusHistory'
import { TRACKING_STATUS_OPTIONS } from '../constants/trackingStatuses'
import { formatDate } from '../utils/dateFormat'

function emptyBuckets() {
  return LEAD_TIME_BUCKETS.reduce((acc, b) => {
    acc[b.key] = { count: 0, items: [] }
    return acc
  }, {})
}

export default function LeadTimeAgingReportPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [entityType, setEntityType] = useState('esd_invoice')
  const [fromStatus, setFromStatus] = useState('Billed')
  const [toStatus, setToStatus] = useState('Delivery In Progress')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState(false)
  const [rows, setRows] = useState([])
  const [expandedBucket, setExpandedBucket] = useState(null)

  const buckets = useMemo(() => {
    const grouped = emptyBuckets()
    for (const row of rows) {
      const key = bucketForDays(row.daysElapsed)
      if (!key || !grouped[key]) continue
      grouped[key].count++
      grouped[key].items.push(row)
    }
    return grouped
  }, [rows])

  const totalCount = rows.length

  const handleGenerate = async () => {
    setError('')
    if (!dateFrom || !dateTo) {
      setError('Please select both start and end dates.')
      return
    }
    if (fromStatus === toStatus) {
      setError('From status and To status must be different.')
      return
    }
    setLoading(true)
    setGenerated(false)
    setExpandedBucket(null)
    try {
      const data = await fetchStatusHistory({
        entityType,
        fromStatus,
        toStatus,
        dateFrom,
        dateTo,
      })
      setRows(Array.isArray(data) ? data : [])
      setGenerated(true)
    } catch (e) {
      setError(e.message || 'Failed to load report data.')
      setRows([])
    }
    setLoading(false)
  }

  const entityLabel = STATUS_HISTORY_ENTITY_TYPES.find((t) => t.value === entityType)?.label || entityType

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-900" />
          <h2 className="text-lg font-semibold text-slate-800">Lead Time Aging Report</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-slate-600 text-sm">
            Shows how many days documents took to move from one status to another within the selected period
            (based on when the &quot;to&quot; status was recorded).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period from</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period to</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Document type</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              >
                {STATUS_HISTORY_ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From status</label>
                <select
                  value={fromStatus}
                  onChange={(e) => setFromStatus(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                >
                  {TRACKING_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To status</label>
                <select
                  value={toStatus}
                  onChange={(e) => setToStatus(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                >
                  {TRACKING_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
          >
            {loading ? 'Generating…' : 'Generate report'}
          </button>
        </div>
      </div>

      {generated && (
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Results</h3>
            <p className="text-sm text-slate-600 mt-1">
              {entityLabel}: {fromStatus} → {toStatus}
              {dateFrom && dateTo ? ` (${formatDate(dateFrom)} – ${formatDate(dateTo)})` : ''}
              {' · '}
              <strong>{totalCount}</strong> transition{totalCount !== 1 ? 's' : ''}
            </p>
          </div>

          {totalCount === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No status transitions found for this filter. Changes are logged when statuses are updated on tracking pages.
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {LEAD_TIME_BUCKETS.map((b) => {
                const group = buckets[b.key]
                const isOpen = expandedBucket === b.key
                return (
                  <div key={b.key} className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedBucket(isOpen ? null : b.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
                    >
                      <span className="font-medium text-slate-800">{b.label}</span>
                      <span className="text-blue-900 font-semibold">{group.count}</span>
                    </button>
                    {isOpen && group.items.length > 0 && (
                      <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                        {group.items.map((row) => (
                          <li key={row.id} className="px-4 py-2 text-sm flex flex-wrap gap-x-4 gap-y-1">
                            <span className="font-medium text-slate-800">{row.documentNo || row.entityId}</span>
                            <span className="text-slate-500">{row.daysElapsed} day{row.daysElapsed !== 1 ? 's' : ''}</span>
                            <span className="text-slate-500 text-xs">
                              {formatDate(row.fromStatusAt)} → {formatDate(row.toStatusAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
