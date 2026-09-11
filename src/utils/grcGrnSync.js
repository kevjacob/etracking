/**
 * GRC ↔ linked GRN helpers: numbering, remarks, and status sync fields.
 */

export const GRC_DIGIT_LEN = 10
export const DO_DIGIT_LEN = 5
export const GRC_NO_PREFIX = 'GRC'
export const GRN_NO_PREFIX = 'GRN'
export const DELIVERY_ORDER_NO_PREFIX = 'DO '
export const REMARK_SEP = ' | '

export function splitRemarkParts(remark) {
  return String(remark ?? '').split(/\s*\|\s*/)
}

export function normalizeDigits(value, maxLen) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLen)
}

export function formatGrcNo(digits) {
  const d = normalizeDigits(digits, GRC_DIGIT_LEN)
  if (d.length !== GRC_DIGIT_LEN) return null
  return `${GRC_NO_PREFIX}${d}`
}

export function formatDoNo(digits) {
  const d = normalizeDigits(digits, DO_DIGIT_LEN)
  if (d.length !== DO_DIGIT_LEN) return null
  return `${GRN_NO_PREFIX}${d}`
}

/** Alias for standalone GRN add form. */
export const formatGrnNo = formatDoNo

export function formatDeliveryOrderNo(digits) {
  const d = normalizeDigits(digits, DO_DIGIT_LEN)
  if (d.length !== DO_DIGIT_LEN) return null
  return `${DELIVERY_ORDER_NO_PREFIX}${d}`
}

export function buildGrcRemark(doNo, doDate, additionalRemark) {
  const base = [doNo, doDate || ''].join(REMARK_SEP)
  const extra = (additionalRemark || '').trim()
  return extra ? `${base}${REMARK_SEP}${extra}` : base
}

export function buildGrnRemarkFromGrc(grcNo, outlet, additionalRemark) {
  const base = [grcNo, (outlet || '').trim()].filter(Boolean).join(REMARK_SEP)
  const extra = (additionalRemark || '').trim()
  return extra ? `${base}${REMARK_SEP}${extra}` : base
}

/** Outlet from row column; legacy remarks may have had outlet as 3rd segment (GRN/DO | date | outlet | …). */
export function getGrcOutlet(row) {
  const stored = (row?.outlet ?? '').trim()
  if (stored) return stored
  const parts = splitRemarkParts(row?.remark).map((p) => p.trim())
  if (parts.length >= 4 && isLinkableDoNo(parts[0])) return parts[2] || ''
  return ''
}

/** Fields synced between linked GRC and GRN rows (not document no/date/remark). */
export function extractSyncFields(row) {
  if (!row) return {}
  return {
    status: row.status,
    statusUpdatedAt: row.statusUpdatedAt,
    assignedDriverId: row.assignedDriverId ?? null,
    assignedSalesmanId: row.assignedSalesmanId ?? null,
    assignedClerkId: row.assignedClerkId ?? null,
    transferWarehouseId: row.transferWarehouseId ?? null,
    holdWarehouseId: row.holdWarehouseId ?? null,
    holdWarehouseType: row.holdWarehouseType ?? '',
    deliveryDate: row.deliveryDate ?? '',
    deliverySlot: row.deliverySlot ?? '',
    discrepancy: row.discrepancy ?? { checked: false, title: '', description: '' },
    remarkAtBilled: row.remarkAtBilled ?? '',
    numberAndDateLocked: row.numberAndDateLocked ?? false,
  }
}

export function mergeLinkedSync(targetRow, sourceRow) {
  return { ...targetRow, ...extractSyncFields(sourceRow) }
}

export function buildDocNoLookup(rows, noField) {
  const map = new Map()
  for (const row of rows || []) {
    const no = String(row?.[noField] ?? '').trim().toUpperCase()
    if (no) map.set(no, row.id)
  }
  return map
}

/** First segment of GRC remark is GRN number (GRN#####, or legacy DO#####). */
export function parseDoNoFromGrcRemark(remark) {
  const first = splitRemarkParts(remark)[0]?.trim()
  return isLinkableDoNo(first) ? first.toUpperCase() : null
}

/** First segment of GRN remark is GRC number (GRC##########). */
export function parseGrcNoFromGrnRemark(remark) {
  const first = splitRemarkParts(remark)[0]?.trim()
  return isLinkableGrcNo(first) ? first.toUpperCase() : null
}

export function resolveLinkedGrn(grcRow, grns) {
  if (!grcRow) return null
  if (grcRow.linkedGrnId) {
    const byId = (grns || []).find((g) => g.id === grcRow.linkedGrnId)
    if (byId) return byId
  }
  const doNo = parseDoNoFromGrcRemark(grcRow.remark)
  if (!doNo) return null
  return (
    (grns || []).find((g) => String(g.grnNo || '').trim().toUpperCase() === doNo) || null
  )
}

export function resolveLinkedGrc(grnRow, grcs) {
  if (!grnRow) return null
  if (grnRow.linkedGrcId) {
    const byId = (grcs || []).find((g) => g.id === grnRow.linkedGrcId)
    if (byId) return byId
  }
  const grcNo = parseGrcNoFromGrnRemark(grnRow.remark)
  if (!grcNo) return null
  return (
    (grcs || []).find((g) => String(g.grcNo || '').trim().toUpperCase() === grcNo) || null
  )
}

export function hasLinkedGrn(grcRow, grns) {
  return !!resolveLinkedGrn(grcRow, grns)
}

export function hasLinkedGrc(grnRow, grcs) {
  return !!resolveLinkedGrc(grnRow, grcs)
}

const GRC_NO_RE = /^GRC\d{10}$/i
const GRN_NO_RE = /^GRN\d{5}$/i
const LEGACY_DO_NO_RE = /^DO\d{5}$/i

export function isLinkableGrcNo(text) {
  return GRC_NO_RE.test(String(text ?? '').trim())
}

export function isLinkableDoNo(text) {
  const value = String(text ?? '').trim()
  return GRN_NO_RE.test(value) || LEGACY_DO_NO_RE.test(value)
}
