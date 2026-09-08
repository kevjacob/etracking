import { normalizeDigits } from './grcGrnSync'
import { saveAdditionalRemark } from './additionalRemark'

export const IV_DIGIT_LEN = 10
export const T_DIGIT_LEN = 5
export const IV_PREFIX = 'IV'
export const T_PREFIX = 'T'

export function formatIvNo(digits) {
  const d = normalizeDigits(digits, IV_DIGIT_LEN)
  if (d.length !== IV_DIGIT_LEN) return null
  return `${IV_PREFIX}${d}`
}

export function formatTNo(digits) {
  const d = normalizeDigits(digits, T_DIGIT_LEN)
  if (d.length !== T_DIGIT_LEN) return null
  return `${T_PREFIX}${d}`
}

/** @typedef {'iv' | 'fn-t' | 'heineken-t'} AutocountInvoiceKind */

export function getAutocountInvoiceNo(kind, digits) {
  if (kind === 'iv') return formatIvNo(digits)
  if (kind === 'fn-t' || kind === 'heineken-t') return formatTNo(digits)
  return null
}

export function buildAutocountAdditionalRemark(kind, userRemark) {
  const brand = kind === 'fn-t' ? 'F&N' : kind === 'heineken-t' ? 'Heineken' : ''
  const extra = (userRemark || '').trim()
  if (brand && extra) return saveAdditionalRemark(`${brand} | ${extra}`)
  if (brand) return saveAdditionalRemark(brand)
  return saveAdditionalRemark(extra)
}

export function getAddInvoiceFormTitle(kind, useAutocountStorage) {
  if (!useAutocountStorage) return 'Add New Invoice'
  if (kind === 'fn-t') return 'Add F&N T Invoice'
  if (kind === 'heineken-t') return 'Add Heineken T Invoice'
  return 'Add IV Invoice'
}
