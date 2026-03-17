import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { fetchInvoices, insertInvoice, updateInvoice } from '../api/invoices'
import { fetchInvoices as fetchAutocountInvoices, insertInvoice as insertAutocountInvoice, updateInvoice as updateAutocountInvoice } from '../api/autocountInvoices'
import { fetchCreditNotes, insertCreditNote, updateCreditNote } from '../api/creditNotes'

function getTodayDateStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function normalizeHeader(h) {
  if (h == null) return ''
  return String(h).trim().toLowerCase().replace(/\s+/g, ' ').replace(/_/g, ' ')
}

function findDocumentIdColumnIndex(headers) {
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeader(headers[i])
    if (n === 'document id' || n === 'documentid') return i
  }
  return -1
}

function parseFileToRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('Could not read file'))
          return
        }
        const isCsv = /\.csv$/i.test(file.name)
        let workbook
        if (isCsv) {
          const str = typeof data === 'string' ? data : new TextDecoder().decode(data)
          workbook = XLSX.read(str, { type: 'string', raw: false })
        } else {
          workbook = XLSX.read(data)
        }
        const firstSheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    if (/\.csv$/i.test(file.name)) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

function buildInvoiceRow(documentId, importDate) {
  return {
    invoiceNo: documentId.trim(),
    dateOfInvoice: importDate,
    status: 'Billed',
    statusUpdatedAt: new Date().toISOString(),
    assignedDriverId: null,
    assignedSalesmanId: null,
    assignedClerkId: null,
    transferWarehouseId: null,
    holdWarehouseId: null,
    holdWarehouseType: '',
    deliveryDate: '',
    deliverySlot: '',
    remark: '',
    remarkAtBilled: '',
    discrepancy: { checked: false, title: '', description: '' },
  }
}

function buildCreditNoteRow(documentId, importDate) {
  return {
    creditNoteNo: documentId.trim(),
    creditNoteDate: importDate,
    numberAndDateLocked: false,
    status: 'Billed',
    assignedDriverId: null,
    assignedSalesmanId: null,
    assignedClerkId: null,
    transferWarehouseId: null,
    holdWarehouseId: null,
    holdWarehouseType: '',
    deliveryDate: '',
    deliverySlot: '',
    remark: '',
    remarkAtBilled: '',
    discrepancy: { checked: false, title: '', description: '' },
  }
}

/** type: 'esd' | 'autocount' | 'creditNote' */
function runImport(nonConflicting, overwriteConflicts, apis) {
  const result = { invoicesCount: 0, autocountInvoicesCount: 0, creditNotesCount: 0, invoiceIds: [], autocountInvoiceIds: [], creditNoteIds: [] }
  const { insertInvoice: insInv, insertAutocountInvoice: insAuto, insertCreditNote: insCN, updateInvoice: updInv, updateAutocountInvoice: updAuto, updateCreditNote: updCN } = apis
  const promises = []
  for (const e of nonConflicting.esd) {
    promises.push(insInv(e.newRow).then((r) => { result.invoicesCount++; result.invoiceIds.push(r.invoiceNo) }))
  }
  for (const e of nonConflicting.autocount) {
    promises.push(insAuto(e.newRow).then((r) => { result.autocountInvoicesCount++; result.autocountInvoiceIds.push(r.invoiceNo) }))
  }
  for (const e of nonConflicting.creditNote) {
    promises.push(insCN(e.newRow).then((r) => { result.creditNotesCount++; result.creditNoteIds.push(r.creditNoteNo) }))
  }
  for (const c of overwriteConflicts) {
    if (c.type === 'esd') {
      promises.push(updInv(c.existingRow.id, c.newRow).then(() => { result.invoicesCount++; result.invoiceIds.push(c.documentId) }))
    } else if (c.type === 'autocount') {
      promises.push(updAuto(c.existingRow.id, c.newRow).then(() => { result.autocountInvoicesCount++; result.autocountInvoiceIds.push(c.documentId) }))
    } else {
      promises.push(updCN(c.existingRow.id, c.newRow).then(() => { result.creditNotesCount++; result.creditNoteIds.push(c.documentId) }))
    }
  }
  return Promise.all(promises).then(() => result)
}

export default function ImportDocumentPage() {
  const fileInputRef = useRef(null)
  const [importResult, setImportResult] = useState(null)
  const [conflictModal, setConflictModal] = useState(null)
  const [partialOverwriteSelected, setPartialOverwriteSelected] = useState({})

  const applyImport = async (nonConflicting, overwriteList) => {
    const apis = {
      insertInvoice,
      insertAutocountInvoice,
      insertCreditNote,
      updateInvoice,
      updateAutocountInvoice,
      updateCreditNote,
    }
    const result = await runImport(nonConflicting, overwriteList, apis)
    setImportResult({ success: true, ...result })
    setConflictModal(null)
    setPartialOverwriteSelected({})
  }

  const handleSkipAll = () => {
    if (!conflictModal) return
    applyImport(conflictModal.nonConflicting, [])
  }

  const handleOverwriteAll = () => {
    if (!conflictModal) return
    applyImport(conflictModal.nonConflicting, conflictModal.conflicts)
  }

  const handleChoosePartial = () => {
    setConflictModal((m) => (m ? { ...m, step: 'partial' } : null))
    const initial = {}
    conflictModal.conflicts.forEach((_, i) => { initial[i] = false })
    setPartialOverwriteSelected(initial)
  }

  const handlePartialBack = () => {
    setConflictModal((m) => (m ? { ...m, step: 'choice' } : null))
    setPartialOverwriteSelected({})
  }

  const handleOverwriteSelected = () => {
    if (!conflictModal) return
    const toOverwrite = conflictModal.conflicts.filter((_, i) => partialOverwriteSelected[i])
    applyImport(conflictModal.nonConflicting, toOverwrite)
  }

  const handleDocumentImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setConflictModal(null)
    const fileName = file.name.toLowerCase()
    const isExcel = /\.(xlsx|xls)$/.test(fileName)
    const isCsv = /\.csv$/.test(fileName)
    if (!isExcel && !isCsv) {
      setImportResult({ error: 'Please choose an Excel (.xlsx, .xls) or CSV file.' })
      e.target.value = ''
      return
    }
    try {
      const rows = await parseFileToRows(file)
      if (!rows.length) {
        setImportResult({ error: 'File is empty or could not be read.' })
        e.target.value = ''
        return
      }
      const headers = rows[0].map((h) => (h != null ? String(h) : ''))
      const docIdCol = findDocumentIdColumnIndex(headers)
      if (docIdCol === -1) {
        setImportResult({
          error: 'No "Document ID" column found. Your file should have a column named "Document ID" (or "DocumentID").',
        })
        e.target.value = ''
        return
      }
      const importDate = getTodayDateStr()
      const [existingEsd, existingAutocount, existingCN] = await Promise.all([
        fetchInvoices(),
        fetchAutocountInvoices(),
        fetchCreditNotes(),
      ])
      const conflicts = []
      const nonConflicting = { esd: [], autocount: [], creditNote: [] }
      for (let r = 1; r < rows.length; r++) {
        const cell = rows[r][docIdCol]
        const docId = cell != null ? String(cell).trim() : ''
        if (!docId) continue
        const upper = docId.toUpperCase()
        if (docId.startsWith('310')) {
          const newRow = buildInvoiceRow(docId, importDate)
          const existing = existingAutocount.find((x) => (x.invoiceNo || '').trim() === (docId || '').trim())
          if (existing) {
            conflicts.push({ type: 'autocount', documentId: docId, existingRow: existing, newRow })
          } else {
            nonConflicting.autocount.push({ documentId: docId, newRow })
          }
        } else if (upper.startsWith('IV')) {
          const newRow = buildInvoiceRow(docId, importDate)
          const existing = existingEsd.find((x) => (x.invoiceNo || '').trim() === (docId || '').trim())
          if (existing) {
            conflicts.push({ type: 'esd', documentId: docId, existingRow: existing, newRow })
          } else {
            nonConflicting.esd.push({ documentId: docId, newRow })
          }
        } else if (upper.startsWith('CN')) {
          const newRow = buildCreditNoteRow(docId, importDate)
          const existing = existingCN.find((x) => (x.creditNoteNo || '').trim() === (docId || '').trim())
          if (existing) {
            conflicts.push({ type: 'creditNote', documentId: docId, existingRow: existing, newRow })
          } else {
            nonConflicting.creditNote.push({ documentId: docId, newRow })
          }
        }
      }
      if (conflicts.length === 0) {
        const apis = {
          insertInvoice,
          insertAutocountInvoice,
          insertCreditNote,
          updateInvoice: () => {},
          updateAutocountInvoice: () => {},
          updateCreditNote: () => {},
        }
        const result = await runImport(nonConflicting, [], apis)
        setImportResult({ success: true, ...result })
      } else {
        setConflictModal({
          step: 'choice',
          conflicts,
          nonConflicting,
        })
      }
    } catch (err) {
      setImportResult({
        error: err.message || 'Failed to parse file. Please check the file format.',
      })
    }
    e.target.value = ''
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Import Document</h2>
          <p className="text-slate-500 text-sm mt-1">
            Upload an Excel (.xlsx, .xls) or CSV file.
          </p>
        </div>
        <div className="p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={handleDocumentImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium shadow"
          >
            <Upload size={18} />
            Choose Excel or CSV file
          </button>
          {importResult?.error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {importResult.error}
            </div>
          )}
          {importResult?.success && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm space-y-1">
              <p className="font-medium">Import completed.</p>
              <p>
                {importResult.invoicesCount} ESD invoice(s), {importResult.autocountInvoicesCount} Autocount invoice(s), and {importResult.creditNotesCount} credit note(s) added.
              </p>
              {importResult.invoiceIds?.length > 0 && (
                <p className="text-xs mt-1">ESD invoices: {importResult.invoiceIds.join(', ')}{importResult.invoicesCount > 20 ? ' …' : ''}</p>
              )}
              {importResult.autocountInvoiceIds?.length > 0 && (
                <p className="text-xs">Autocount invoices: {importResult.autocountInvoiceIds.join(', ')}{importResult.autocountInvoicesCount > 20 ? ' …' : ''}</p>
              )}
              {importResult.creditNoteIds?.length > 0 && (
                <p className="text-xs">Credit notes: {importResult.creditNoteIds.join(', ')}{importResult.creditNotesCount > 20 ? ' …' : ''}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conflict modal – choice step */}
      {conflictModal && conflictModal.step === 'choice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setConflictModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Document(s) already exist</h3>
            <p className="text-slate-600 text-sm mb-2">
              <strong>{conflictModal.conflicts.length}</strong> document(s) from your file already exist in the system.
            </p>
            <p className="text-amber-800 text-sm mb-4 bg-amber-50 border border-amber-200 rounded p-2">
              If you overwrite, existing status progress will be reset (e.g. back to Billed). Choose how to proceed.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSkipAll}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
              >
                Skip all – only add new documents
              </button>
              <button
                type="button"
                onClick={handleOverwriteAll}
                className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
              >
                Overwrite all – reset all {conflictModal.conflicts.length} existing
              </button>
              <button
                type="button"
                onClick={handleChoosePartial}
                className="w-full px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium"
              >
                Choose which to overwrite
              </button>
              <button
                type="button"
                onClick={() => setConflictModal(null)}
                className="w-full px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict modal – partial overwrite step */}
      {conflictModal && conflictModal.step === 'partial' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handlePartialBack}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Choose which to overwrite</h3>
              <p className="text-amber-800 text-sm mt-1 bg-amber-50 border border-amber-200 rounded p-2">
                Overwriting will reset status progress for the selected document(s).
              </p>
            </div>
            <ul className="overflow-y-auto p-4 flex-1 border-b border-slate-200">
              {conflictModal.conflicts.map((c, i) => (
                <li key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <input
                    type="checkbox"
                    id={`conflict-${i}`}
                    checked={!!partialOverwriteSelected[i]}
                    onChange={(e) => setPartialOverwriteSelected((prev) => ({ ...prev, [i]: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                  />
                  <label htmlFor={`conflict-${i}`} className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium text-slate-800">{c.documentId}</span>
                    <span className="text-slate-500 ml-2">
                      ({c.type === 'esd' ? 'ESD Invoice' : c.type === 'autocount' ? 'Autocount Invoice' : 'Credit Note'}
                      {c.existingRow.status ? ` – current: ${c.existingRow.status}` : ''})
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="p-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={handlePartialBack}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleOverwriteSelected}
                disabled={!Object.values(partialOverwriteSelected).some(Boolean)}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Overwrite selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
