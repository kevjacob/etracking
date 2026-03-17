import { useRef } from 'react'
import { Download, Upload, FileJson } from 'lucide-react'

const BACKUP_KEYS = [
  'etracking_employees',
  'etracking_warehouses',
  'etracking_invoices',
  'etracking_invoices_autocount',
  'etracking_credit_notes',
  'etracking_delivery_orders',
  'etracking_grn',
]

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function JsonImportExportPage() {
  const fileInputRef = useRef(null)

  const handleDownload = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {},
    }
    for (const key of BACKUP_KEYS) {
      try {
        const raw = localStorage.getItem(key)
        data.data[key] = raw != null ? JSON.parse(raw) : []
      } catch {
        data.data[key] = []
      }
    }
    const date = new Date().toISOString().slice(0, 10)
    downloadJson(data, `etracking-backup-${date}.json`)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        const data = parsed?.data ?? parsed
        if (typeof data !== 'object' || data === null) {
          alert('Invalid backup file: expected an object with record data.')
          e.target.value = ''
          return
        }
        for (const key of BACKUP_KEYS) {
          if (key in data && data[key] !== undefined) {
            const value = data[key]
            localStorage.setItem(key, JSON.stringify(value))
          }
        }
        alert('Backup restored successfully. The page will reload.')
        window.location.reload()
      } catch (err) {
        alert('Invalid JSON file: ' + (err.message || 'Could not parse file.'))
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileJson size={20} />
            JSON Import/Export
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Download all records as a JSON backup or upload a backup file to restore.
          </p>
        </div>

        <div className="p-5 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Download backup</h3>
            <p className="text-slate-500 text-sm mb-3">
              Save a JSON file containing employees, warehouses, invoices, credit notes, delivery orders, and GRN records.
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium shadow"
            >
              <Download size={18} />
              Download JSON
            </button>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Restore from backup</h3>
            <p className="text-slate-500 text-sm mb-3">
              Upload a previously exported JSON file to replace current data. The page will reload after restore.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium shadow"
            >
              <Upload size={18} />
              Upload backup file
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
