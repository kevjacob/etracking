import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronDown, X, Printer, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useAuth } from '../context/AuthContext'
import { useEmployees } from '../context/EmployeesContext'
import { fetchInvoices } from '../api/invoices'
import { formatDate } from '../utils/dateFormat'

const STATUS_OPTIONS = [
  'Billed',
  'Preparing Delivery',
  'Hold - Office',
  'Hold - Warehouse',
  'Hold - Salesman',
  'Chop & Sign - Office',
  'Chop & Sign - Warehouse',
  'Chop & Sign - Salesman',
  'Transfer',
  'Delivery In Progress',
  'Delivered',
  'Completed',
  'Cancelled',
]

function getAssignedToDisplay(row, employees) {
  const parts = []
  const driver = employees.find((e) => e.id === row.assignedDriverId)
  const salesman = employees.find((e) => e.id === row.assignedSalesmanId)
  const clerk = employees.find((e) => e.id === row.assignedClerkId)
  if (driver) parts.push(driver.name)
  if (salesman) parts.push(salesman.name)
  if (clerk) parts.push(clerk.name)
  return parts.length ? parts.join(', ') : '–'
}

function discrepancyDisplay(discrepancy) {
  if (!discrepancy || !discrepancy.checked) return 'No'
  const t = discrepancy.title ? `: ${discrepancy.title}` : ''
  return `Yes${t}`
}

export default function ESDInvoiceReportPage() {
  const { user } = useAuth()
  const { employees } = useEmployees()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState(() =>
    STATUS_OPTIONS.reduce((acc, s) => ({ ...acc, [s]: false }), {})
  )
  const [selectedAssignedIds, setSelectedAssignedIds] = useState(new Set())
  const [reportGenerated, setReportGenerated] = useState(false)
  const [reportRows, setReportRows] = useState([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [assignedDropdownOpen, setAssignedDropdownOpen] = useState(false)
  const statusDropdownRef = useRef(null)
  const assignedDropdownRef = useRef(null)

  useEffect(() => {
    fetchInvoices()
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false))
  }, [])

  const filteredRows = useMemo(() => {
    let list = invoices

    const from = dateFrom ? new Date(dateFrom) : null
    const to = dateTo ? new Date(dateTo) : null
    if (from || to) {
      list = list.filter((row) => {
        const d = row.dateOfInvoice ? new Date(row.dateOfInvoice) : null
        if (!d || isNaN(d.getTime())) return false
        if (from && d < from) return false
        if (to) {
          const toEnd = new Date(to)
          toEnd.setHours(23, 59, 59, 999)
          if (d > toEnd) return false
        }
        return true
      })
    }

    const statusList = Object.entries(selectedStatuses)
      .filter(([, v]) => v)
      .map(([s]) => s)
    if (statusList.length > 0) {
      list = list.filter((row) => statusList.includes(row.status))
    }

    if (selectedAssignedIds.size > 0) {
      list = list.filter((row) => {
        const ids = [
          row.assignedDriverId,
          row.assignedSalesmanId,
          row.assignedClerkId,
        ].filter(Boolean)
        return ids.some((id) => selectedAssignedIds.has(id))
      })
    }

    return list
  }, [invoices, dateFrom, dateTo, selectedStatuses, selectedAssignedIds])

  const handleGenerate = () => {
    setReportRows(filteredRows)
    setReportGenerated(true)
  }

  const toggleStatus = (status) => {
    setSelectedStatuses((prev) => ({ ...prev, [status]: !prev[status] }))
  }

  const toggleAssigned = (id) => {
    setSelectedAssignedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dateRangeText = useMemo(() => {
    if (!dateFrom && !dateTo) return '–'
    if (dateFrom && dateTo && dateFrom === dateTo) return formatDate(dateFrom)
    const a = dateFrom ? formatDate(dateFrom) : '–'
    const b = dateTo ? formatDate(dateTo) : '–'
    return `${a} ~ ${b}`
  }, [dateFrom, dateTo])

  const assignedToText = useMemo(() => {
    if (selectedAssignedIds.size === 0) return 'All'
    const names = employees
      .filter((e) => selectedAssignedIds.has(e.id))
      .map((e) => e.name)
    return names.length ? names.join(', ') : 'All'
  }, [selectedAssignedIds, employees])

  const selectedStatusCount = useMemo(
    () => Object.values(selectedStatuses).filter(Boolean).length,
    [selectedStatuses]
  )
  const statusLabel = selectedStatusCount === 0 ? 'All' : `${selectedStatusCount} selected`
  const assignedLabel = selectedAssignedIds.size === 0 ? 'All' : `${selectedAssignedIds.size} selected`

  useEffect(() => {
    const closeStatus = (e) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) setStatusDropdownOpen(false)
    }
    const closeAssigned = (e) => {
      if (assignedDropdownRef.current && !assignedDropdownRef.current.contains(e.target)) setAssignedDropdownOpen(false)
    }
    document.addEventListener('click', closeStatus)
    document.addEventListener('click', closeAssigned)
    return () => {
      document.removeEventListener('click', closeStatus)
      document.removeEventListener('click', closeAssigned)
    }
  }, [])

  const printReportRef = useRef(null)

  const handlePrint = () => {
    if (!printReportRef.current) return
    const content = printReportRef.current.innerHTML
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ESD Invoice Tracking Report</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
            .header { margin-bottom: 20px; }
            .header h1 { font-size: 18px; margin: 0 0 4px 0; }
            .header h2 { font-size: 16px; margin: 0 0 12px 0; font-weight: 600; }
            .meta { color: #475569; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background: #f1f5f9; font-weight: 600; }
            tr:nth-child(even) { background: #f8fafc; }
            .footer { margin-top: 16px; font-weight: 600; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 250)
  }

  const handleSaveToPC = () => {
    if (!printReportRef.current) return
    const el = printReportRef.current
    const scrollParent = el.parentElement
    if (scrollParent && typeof scrollParent.scrollTop === 'number') {
      scrollParent.scrollTop = 0
    }
    el.scrollIntoView({ block: 'start', behavior: 'auto' })
    setTimeout(() => {
      html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'a4', true)
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const margin = 20
        const contentWidth = pdfWidth - margin * 2
        const contentHeight = pdfHeight - margin * 2
        const imgWidth = contentWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let position = margin
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        position -= contentHeight
        while (position + imgHeight > margin) {
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
          position -= contentHeight
        }
        pdf.save(`ESD_Invoice_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
      }).catch((err) => {
        console.error('PDF export failed:', err)
      })
    }, 200)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">ESD Invoice Report</h1>

      <section className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date range</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Leave empty for no date filter. Use same date for single day.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div ref={statusDropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <button
              type="button"
              onClick={() => setStatusDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between rounded border border-slate-300 bg-white px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50"
            >
              <span className="truncate">{statusLabel}</span>
              <ChevronDown size={16} className={`shrink-0 text-slate-500 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded border border-slate-200 bg-white py-1 shadow-lg">
                {STATUS_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStatuses[status] ?? false}
                      onChange={() => toggleStatus(status)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-blue-900"
                    />
                    {status}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div ref={assignedDropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Assigned to</label>
            <button
              type="button"
              onClick={() => setAssignedDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between rounded border border-slate-300 bg-white px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50"
            >
              <span className="truncate">{assignedLabel}</span>
              <ChevronDown size={16} className={`shrink-0 text-slate-500 ${assignedDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {assignedDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded border border-slate-200 bg-white py-1 shadow-lg">
                {employees.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No employees</div>
                ) : (
                  employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssignedIds.has(emp.id)}
                        onChange={() => toggleAssigned(emp.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 text-blue-900"
                      />
                      {emp.name} ({emp.position})
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGenerate}
            className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
          >
            Generate Report
          </button>
        </div>
      </section>

      {reportGenerated && (
        <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Report generated</span>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm font-medium"
            >
              Preview report
            </button>
          </div>
          <div className="p-6 border-b border-slate-200 space-y-1 text-sm">
            <p className="font-semibold text-slate-900">Tai Say Company Sdn Bhd</p>
            <p className="font-semibold text-slate-800">ESD Invoice Tracking Report</p>
            <p className="text-slate-600">The date range of report : {dateRangeText}</p>
            <p className="text-slate-600">Assigned To : {assignedToText}</p>
            <p className="text-slate-600">Generated by : {user?.name || user?.username || '–'}</p>
            <p className="text-slate-600">The date of report generated : {formatDate(new Date().toISOString())}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Invoice Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Invoice Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Assigned To</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Remark</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No invoices match the selected filters.
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-4 text-slate-700">{formatDate(row.dateOfInvoice) || '–'}</td>
                      <td className="py-2 px-4 text-slate-700">{row.invoiceNo || '–'}</td>
                      <td className="py-2 px-4 text-slate-700">{row.status || '–'}</td>
                      <td className="py-2 px-4 text-slate-700">
                        {getAssignedToDisplay(row, employees)}
                      </td>
                      <td className="py-2 px-4 text-slate-700 max-w-[200px] truncate" title={row.remark || ''}>
                        {row.remark || '–'}
                      </td>
                      <td className="py-2 px-4 text-slate-700">
                        {discrepancyDisplay(row.discrepancy)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-800">Total invoice : {reportRows.length}</p>
          </div>
        </section>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
              <h3 className="text-lg font-semibold text-slate-800">Report Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
                >
                  <Printer size={18} />
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleSaveToPC}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 text-sm font-medium"
                >
                  <Download size={18} />
                  Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 rounded text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-6 flex-1">
              <div
                ref={printReportRef}
                className="report-print-area bg-white text-slate-800 pt-8 pb-8"
              >
                <div className="header mb-4">
                  <h1 className="text-lg font-semibold text-slate-900">Tai Say Company Sdn Bhd</h1>
                  <h2 className="text-base font-semibold text-slate-800">ESD Invoice Tracking Report</h2>
                </div>
                <div className="meta space-y-1 text-sm text-slate-600 mb-6">
                  <p>The date range of report : {dateRangeText}</p>
                  <p>Assigned To : {assignedToText}</p>
                  <p>Generated by : {user?.name || user?.username || '–'}</p>
                  <p className="pb-1">The date of report generated : {formatDate(new Date().toISOString())}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-200 py-2 px-3 text-left font-semibold">Invoice Date</th>
                        <th className="border border-slate-200 py-2 px-3 text-left font-semibold">Invoice Number</th>
                        <th className="border border-slate-200 py-2 px-3 text-left font-semibold">Status</th>
                        <th className="border border-slate-200 py-2 px-3 text-left font-semibold">Assigned To</th>
                        <th className="border border-slate-200 py-2 px-3 text-left font-semibold">Remark</th>
                        <th className="border border-slate-200 py-2 px-3 text-left font-semibold">Discrepancy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="border border-slate-200 py-6 text-center text-slate-500">
                            No invoices match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        reportRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100">
                            <td className="border border-slate-200 py-2 px-3">{formatDate(row.dateOfInvoice) || '–'}</td>
                            <td className="border border-slate-200 py-2 px-3">{row.invoiceNo || '–'}</td>
                            <td className="border border-slate-200 py-2 px-3">{row.status || '–'}</td>
                            <td className="border border-slate-200 py-2 px-3">{getAssignedToDisplay(row, employees)}</td>
                            <td className="border border-slate-200 py-2 px-3 max-w-[180px]">{row.remark || '–'}</td>
                            <td className="border border-slate-200 py-2 px-3">{discrepancyDisplay(row.discrepancy)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="footer mt-4 text-sm font-medium">
                  Total invoice : {reportRows.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
