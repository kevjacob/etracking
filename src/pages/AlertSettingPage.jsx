import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAlertSettings } from '../context/AlertSettingsContext'
import { saveAlertSettings } from '../api/alertSettings'
import { TRACKING_STATUS_OPTIONS, COD_ALERT_SETTING_KEY } from '../constants/trackingStatuses'
import { mergeAlertSettings } from '../utils/alertStatus'

function formatDaysInput(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return String(n)
}

export default function AlertSettingPage() {
  const navigate = useNavigate()
  const { user, isSuperuser, authReady } = useAuth()
  const { settings, setSettings, reloadSettings, loading } = useAlertSettings()
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (authReady && user && !isSuperuser) {
      navigate('/', { replace: true })
    }
  }, [authReady, user, isSuperuser, navigate])

  useEffect(() => {
    if (!loading) {
      setDraft(mergeAlertSettings(settings))
    }
  }, [settings, loading])

  if (!isSuperuser) {
    return null
  }

  const handleDaysChange = (key, raw) => {
    setSuccess('')
    setError('')
    if (raw === '') {
      setDraft((prev) => ({ ...prev, [key]: '' }))
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return
    setDraft((prev) => ({ ...prev, [key]: n }))
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    const normalized = mergeAlertSettings(draft)
    for (const status of TRACKING_STATUS_OPTIONS) {
      const v = draft[status]
      if (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0) {
        setError(`Please enter a valid number of days for "${status}".`)
        return
      }
    }
    const codVal = draft[COD_ALERT_SETTING_KEY]
    if (codVal === '' || codVal == null || !Number.isFinite(Number(codVal)) || Number(codVal) < 0) {
      setError('Please enter a valid number of days for C.O.D.')
      return
    }
    setSaving(true)
    try {
      const saved = await saveAlertSettings(user.username, normalized)
      setSettings(saved)
      setDraft(saved)
      setSuccess('Alert settings saved.')
    } catch (e) {
      setError(e.message || 'Failed to save alert settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setDraft(mergeAlertSettings(settings))
    setError('')
    setSuccess('')
    navigate(-1)
  }

  const handleReset = async () => {
    setError('')
    setSuccess('')
    await reloadSettings()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <AlertTriangle size={20} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-800">Alert Setting</h2>
        </div>
        <div className="px-5 py-4 border-b border-slate-100 text-sm text-slate-600">
          Set how many days a document can stay in each status (or as C.O.D) before it appears on the Home alerts page.
          Set 0 to disable alerts for that status or C.O.D.
        </div>
        {loading ? (
          <div className="px-5 py-8 text-slate-500 text-sm">Loading settings…</div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              <div className="px-5 py-2 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Status</h3>
              </div>
              {TRACKING_STATUS_OPTIONS.map((status) => (
                <div key={status} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex-1 text-sm text-slate-800">{status}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formatDaysInput(draft[status])}
                      onChange={(e) => handleDaysChange(status, e.target.value)}
                      className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900"
                      aria-label={`Alert period for ${status}`}
                    />
                    <span className="text-sm text-slate-500 w-12">day(s)</span>
                  </div>
                </div>
              ))}
              <div className="px-5 py-2 bg-slate-50 border-y border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">C.O.D</h3>
              </div>
              <div className="flex items-center gap-4 px-5 py-3">
                <span className="flex-1 text-sm text-slate-800">C.O.D (Cash on Delivery)</span>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formatDaysInput(draft[COD_ALERT_SETTING_KEY])}
                    onChange={(e) => handleDaysChange(COD_ALERT_SETTING_KEY, e.target.value)}
                    className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900"
                    aria-label="Alert period for C.O.D"
                  />
                  <span className="text-sm text-slate-500 w-12">day(s)</span>
                </div>
              </div>
            </div>
            {error && (
              <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-t border-red-100">{error}</div>
            )}
            {success && (
              <div className="px-5 py-3 text-sm text-green-700 bg-green-50 border-t border-green-100">{success}</div>
            )}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium text-sm"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-50 font-medium text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={saving || loading}
                className="ml-auto px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:underline disabled:opacity-50"
              >
                Reset unsaved changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
