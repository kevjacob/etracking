/**
 * IDT (Inter-Depot Transfer) helpers: numbering, remarks, transfer display.
 */

export const IDT_DIGIT_LEN = 10
export const IDT_NO_PREFIX = 'IDT'
export const REMARK_SEP = ' | '

export function normalizeDigits(value, maxLen) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLen)
}

export function formatIdtNo(digits) {
  const d = normalizeDigits(digits, IDT_DIGIT_LEN)
  if (d.length !== IDT_DIGIT_LEN) return null
  return `${IDT_NO_PREFIX}${d}`
}

export function buildIdtRemark(withCharges, userRemark) {
  const charges = withCharges ? 'With Charges' : 'Without Charges'
  const extra = (userRemark || '').trim()
  return extra ? `${charges}${REMARK_SEP}${extra}` : charges
}

export function getIdtTransfer(row, warehouses) {
  const from = (warehouses || []).find((w) => w.id === row?.fromWarehouseId)
  const to = (warehouses || []).find((w) => w.id === row?.toWarehouseId)
  if (from?.name && to?.name) return `${from.name} > ${to.name}`
  return ''
}
