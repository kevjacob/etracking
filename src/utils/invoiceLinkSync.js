import { REMARK_SEP, splitRemarkParts, extractSyncFields, mergeLinkedSync } from './grcGrnSync'

const ESD_INVOICE_RE = /^\d+$/
const IV_INVOICE_RE = /^IV\d{10}$/i
const T_INVOICE_RE = /^T\d{5}$/i
const GRN_NO_RE = /^GRN\d{5}$/i
const DO_NO_RE = /^DO\s?\d+$/i

export function isLinkableInvoiceNo(text) {
  const value = String(text ?? '').trim()
  return ESD_INVOICE_RE.test(value) || IV_INVOICE_RE.test(value) || T_INVOICE_RE.test(value)
}

export function isLinkableGrnNo(text) {
  return GRN_NO_RE.test(String(text ?? '').trim())
}

export function isLinkableDeliveryOrderNo(text) {
  const value = String(text ?? '').trim()
  return value.length > 0 && (DO_NO_RE.test(value) || /^DO/i.test(value) || !isLinkableInvoiceNo(value))
}

export function parseInvoiceNoFromRemark(remark) {
  const first = splitRemarkParts(remark)[0]?.trim()
  return first && isLinkableInvoiceNo(first) ? first : null
}

export function parseGrnNoFromInvoiceRemark(remark) {
  const first = splitRemarkParts(remark)[0]?.trim()
  return first && isLinkableGrnNo(first) ? first.toUpperCase() : null
}

export function parseDoNoFromInvoiceRemark(remark) {
  const first = splitRemarkParts(remark)[0]?.trim()
  if (!first || isLinkableInvoiceNo(first) || isLinkableGrnNo(first)) return null
  return first
}

export function buildRemarkWithLinkedInvoice(invoiceNo, extraRemark) {
  const inv = String(invoiceNo || '').trim()
  const extra = String(extraRemark || '').trim()
  if (!inv) return extra
  return extra ? `${inv}${REMARK_SEP}${extra}` : inv
}

export function buildRemarkWithLinkedInvoices(invoiceNos, extraRemark) {
  const nos = (invoiceNos || []).map((n) => String(n || '').trim()).filter(Boolean)
  const extra = String(extraRemark || '').trim()
  if (nos.length === 0) return extra
  return extra ? `${nos.join(REMARK_SEP)}${REMARK_SEP}${extra}` : nos.join(REMARK_SEP)
}

export function buildInvoiceRemarkWithLinkedDoc(docNo, extraRemark) {
  const doc = String(docNo || '').trim()
  const extra = String(extraRemark || '').trim()
  if (!doc) return extra
  return extra ? `${doc}${REMARK_SEP}${extra}` : doc
}

export function buildCombinedInvoiceLookup(esdInvoices, autocountInvoices) {
  const map = new Map()
  for (const row of esdInvoices || []) {
    const no = String(row?.invoiceNo ?? '').trim()
    if (no) map.set(no.toUpperCase(), { id: row.id, type: 'esd', invoiceNo: no })
  }
  for (const row of autocountInvoices || []) {
    const no = String(row?.invoiceNo ?? '').trim()
    if (no) map.set(no.toUpperCase(), { id: row.id, type: 'autocount', invoiceNo: no })
  }
  return map
}

export function resolveLinkedInvoice(row, esdInvoices, autocountInvoices) {
  const invoiceNo = parseInvoiceNoFromRemark(row?.remark)
  if (!invoiceNo) return null
  const upper = invoiceNo.toUpperCase()
  const fromEsd = (esdInvoices || []).find((r) => String(r.invoiceNo || '').trim().toUpperCase() === upper)
  if (fromEsd) return { ...fromEsd, _linkType: 'esd' }
  const fromAc = (autocountInvoices || []).find((r) => String(r.invoiceNo || '').trim().toUpperCase() === upper)
  if (fromAc) return { ...fromAc, _linkType: 'autocount' }
  return null
}

export function hasLinkedInvoice(row) {
  return !!parseInvoiceNoFromRemark(row?.remark)
}

export function getLinkedDocExtraRemark(remark) {
  const parts = splitRemarkParts(remark)
  if (parts.length <= 1) return ''
  return parts.slice(1).join(REMARK_SEP).trim()
}

export function hasLinkedDocInInvoiceRemark(row) {
  return !!(parseGrnNoFromInvoiceRemark(row?.remark) || parseDoNoFromInvoiceRemark(row?.remark))
}

export function resolveLinkedGrnFromInvoice(invoiceRow, grns) {
  const grnNo = parseGrnNoFromInvoiceRemark(invoiceRow?.remark)
  if (!grnNo) return null
  return (
    (grns || []).find((g) => String(g.grnNo || '').trim().toUpperCase() === grnNo) || null
  )
}

export function resolveLinkedDoFromInvoice(invoiceRow, deliveryOrders) {
  const doNo = parseDoNoFromInvoiceRemark(invoiceRow?.remark)
  if (!doNo) return null
  const upper = doNo.toUpperCase()
  return (
    (deliveryOrders || []).find(
      (d) => String(d.deliveryOrderNo || '').trim().toUpperCase() === upper
    ) || null
  )
}

export function buildInvoiceUpdateForDocLink(invoiceRow, sourceRow, docNo) {
  const extra = getLinkedDocExtraRemark(invoiceRow?.remark)
  return {
    ...mergeLinkedSync(invoiceRow, sourceRow),
    remark: buildInvoiceRemarkWithLinkedDoc(docNo, extra),
  }
}

export function buildDocUpdateForInvoiceLink(docRow, invoiceRow, invoiceNo) {
  const extra = getLinkedDocExtraRemark(docRow?.remark)
  return {
    ...mergeLinkedSync(docRow, invoiceRow),
    remark: buildRemarkWithLinkedInvoice(invoiceNo, extra),
  }
}

export function searchInvoicesCombined(esdInvoices, autocountInvoices, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const combined = [
    ...(esdInvoices || []).map((r) => ({ ...r, _source: 'esd' })),
    ...(autocountInvoices || []).map((r) => ({ ...r, _source: 'autocount' })),
  ]
  return combined
    .filter((r) => (r.invoiceNo || '').toLowerCase().includes(q))
    .slice(0, 20)
}

export { extractSyncFields, mergeLinkedSync } from './grcGrnSync'
