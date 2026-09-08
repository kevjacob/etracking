import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { recordInitialStatus } from '../utils/recordStatusTransition'
import { fetchInvoices, insertInvoice } from '../api/invoices'
import { fetchInvoices as fetchAutocountInvoices, insertInvoice as insertAutocountInvoice } from '../api/autocountInvoices'
import { fetchCreditNotes, insertCreditNote } from '../api/creditNotes'

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

function findDocNoColumnIndex(headers) {
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeader(headers[i])
    if (n === 'docno' || n === 'doc no' || n === 'document no' || n === 'document number') return i
  }
  return -1
}

/** Prefer Document ID; fall back to DocNo when Document ID is absent. */
function findDocumentNumberColumnIndex(headers) {
  const docIdCol = findDocumentIdColumnIndex(headers)
  if (docIdCol >= 0) return docIdCol
  return findDocNoColumnIndex(headers)
}

function findDocTypeColumnIndex(headers) {
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeader(headers[i])
    if (n === 'doctype' || n === 'doc type' || n === 'document type') return i
  }
  return -1
}

function normalizeDocType(value) {
  if (value == null || value === '') return ''
  return String(value).trim().toUpperCase()
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

function normalizeDocumentId(cell) {
  if (cell == null || cell === '') return ''
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    if (Number.isInteger(cell) || Math.abs(cell - Math.round(cell)) < 1e-6) {
      return String(Math.round(cell))
    }
  }
  const s = String(cell).trim()
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, '')
  return s
}

function buildExistingNoSet(rows, getNo) {
  const set = new Set()
  for (const row of rows) {
    const no = normalizeDocumentId(getNo(row))
    if (no) set.add(no)
  }
  return set
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

/** @returns {'esd' | 'autocount' | 'creditNote' | null} */
function classifyImportDocument(docId, docType) {
  const trimmed = (docId || '').trim()
  if (!trimmed) return null
  if (normalizeDocType(docType) === 'CN') return 'creditNote'
  const upper = trimmed.toUpperCase()
  if (upper.startsWith('CN')) return 'creditNote'
  if (upper.startsWith('IV')) return 'autocount'
  if (upper.startsWith('T')) return 'autocount'
  if (!/[A-Za-z]/.test(trimmed)) return 'esd'
  return null
}

async function runImport(toInsert) {
  const result = {
    invoicesCount: 0,
    autocountInvoicesCount: 0,
    creditNotesCount: 0,
    invoiceIds: [],
    autocountInvoiceIds: [],
    creditNoteIds: [],
  }
  for (const e of toInsert.esd) {
    const r = await insertInvoice(e.newRow)
    result.invoicesCount++
    result.invoiceIds.push(r.invoiceNo)
    recordInitialStatus({
      entityType: 'esd_invoice',
      entityId: r.id,
      documentNo: r.invoiceNo,
      status: r.status || 'Billed',
      statusAt: r.statusUpdatedAt,
    })
  }
  for (const e of toInsert.autocount) {
    const r = await insertAutocountInvoice(e.newRow)
    result.autocountInvoicesCount++
    result.autocountInvoiceIds.push(r.invoiceNo)
    recordInitialStatus({
      entityType: 'autocount_invoice',
      entityId: r.id,
      documentNo: r.invoiceNo,
      status: r.status || 'Billed',
      statusAt: r.statusUpdatedAt,
    })
  }
  for (const e of toInsert.creditNote) {
    const r = await insertCreditNote(e.newRow)
    result.creditNotesCount++
    result.creditNoteIds.push(r.creditNoteNo)
    recordInitialStatus({
      entityType: 'credit_note',
      entityId: r.id,
      documentNo: r.creditNoteNo,
      status: r.status || 'Billed',
      statusAt: r.statusUpdatedAt,
    })
  }
  return result
}

export default function ImportDocumentPage() {
  const fileInputRef = useRef(null)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)

  const handleDocumentImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file || importing) return
    setImporting(true)
    setImportResult(null)
    try {
      const fileName = file.name.toLowerCase()
      const isExcel = /\.(xlsx|xls)$/.test(fileName)
      const isCsv = /\.csv$/.test(fileName)
      if (!isExcel && !isCsv) {
        setImportResult({ error: 'Please choose an Excel (.xlsx, .xls) or CSV file.' })
        return
      }
      const rows = await parseFileToRows(file)
      if (!rows.length) {
        setImportResult({ error: 'File is empty or could not be read.' })
        return
      }
      const headers = rows[0].map((h) => (h != null ? String(h) : ''))
      const docIdCol = findDocumentNumberColumnIndex(headers)
      if (docIdCol === -1) {
        setImportResult({
          error: 'No document number column found. Your file needs "Document ID" (or "DocumentID") or "DocNo" (or "Doc No").',
        })
        return
      }
      const docTypeCol = findDocTypeColumnIndex(headers)
      const importDate = getTodayDateStr()
      const [existingEsd, existingAutocount, existingCN] = await Promise.all([
        fetchInvoices(),
        fetchAutocountInvoices(),
        fetchCreditNotes(),
      ])
      const seenEsd = buildExistingNoSet(existingEsd, (x) => x.invoiceNo)
      const seenAutocount = buildExistingNoSet(existingAutocount, (x) => x.invoiceNo)
      const seenCN = buildExistingNoSet(existingCN, (x) => x.creditNoteNo)
      const skipped = []
      const toInsert = { esd: [], autocount: [], creditNote: [] }
      for (let r = 1; r < rows.length; r++) {
        const docId = normalizeDocumentId(rows[r][docIdCol])
        if (!docId) continue
        const docTypeCell = docTypeCol >= 0 ? rows[r][docTypeCol] : ''
        const docType = classifyImportDocument(docId, docTypeCell)
        if (docType === 'autocount') {
          if (seenAutocount.has(docId)) {
            skipped.push({ documentId: docId, type: 'autocount' })
          } else {
            seenAutocount.add(docId)
            toInsert.autocount.push({ documentId: docId, newRow: buildInvoiceRow(docId, importDate) })
          }
        } else if (docType === 'esd') {
          if (seenEsd.has(docId)) {
            skipped.push({ documentId: docId, type: 'esd' })
          } else {
            seenEsd.add(docId)
            toInsert.esd.push({ documentId: docId, newRow: buildInvoiceRow(docId, importDate) })
          }
        } else if (docType === 'creditNote') {
          if (seenCN.has(docId)) {
            skipped.push({ documentId: docId, type: 'creditNote' })
          } else {
            seenCN.add(docId)
            toInsert.creditNote.push({ documentId: docId, newRow: buildCreditNoteRow(docId, importDate) })
          }
        }
      }
      const result = await runImport(toInsert)
      setImportResult({
        success: true,
        skippedCount: skipped.length,
        skippedIds: skipped.map((s) => s.documentId),
        ...result,
      })
    } catch (err) {
      setImportResult({
        error: err.message || 'Failed to parse file. Please check the file format.',
      })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Import Document</h2>
          <p className="text-slate-500 text-sm mt-1">
            Upload an Excel (.xlsx, .xls) or CSV file with Document ID or DocNo, optional DocType (CN). IV/T → Autocount; numbers only → ESD. Existing document numbers are skipped (not overwritten).
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
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium shadow disabled:opacity-50"
          >
            <Upload size={18} />
            {importing ? 'Importing…' : 'Choose Excel or CSV file'}
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
              {importResult.skippedCount > 0 && (
                <p className="text-amber-800">
                  {importResult.skippedCount} duplicate document(s) skipped (already in system).
                </p>
              )}
              {importResult.invoiceIds?.length > 0 && (
                <p className="text-xs mt-1">ESD invoices: {importResult.invoiceIds.join(', ')}{importResult.invoicesCount > 20 ? ' …' : ''}</p>
              )}
              {importResult.autocountInvoiceIds?.length > 0 && (
                <p className="text-xs">Autocount invoices: {importResult.autocountInvoiceIds.join(', ')}{importResult.autocountInvoicesCount > 20 ? ' …' : ''}</p>
              )}
              {importResult.creditNoteIds?.length > 0 && (
                <p className="text-xs">Credit notes: {importResult.creditNoteIds.join(', ')}{importResult.creditNotesCount > 20 ? ' …' : ''}</p>
              )}
              {importResult.skippedIds?.length > 0 && (
                <p className="text-xs text-amber-800">
                  Skipped: {importResult.skippedIds.join(', ')}{importResult.skippedCount > 20 ? ' …' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
