import { parseDate } from './dateFormat'

export const TRACKING_PAGE_SIZE = 30

export function getMonthKeyFromDate(dateStr) {
  if (!dateStr) return null
  const parsed = parseDate(dateStr)
  if (!parsed || parsed.length < 7) return null
  return parsed.slice(0, 7)
}

export function formatMonthLabel(monthKey) {
  if (!monthKey) return ''
  const [year, month] = monthKey.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  if (isNaN(d.getTime())) return monthKey
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getAvailableMonths(rows, getDateField) {
  const keys = new Set()
  for (const row of rows) {
    const key = getMonthKeyFromDate(getDateField(row))
    if (key) keys.add(key)
  }
  return Array.from(keys).sort().reverse()
}

export function filterRowsByMonth(rows, monthKey, getDateField) {
  if (!monthKey) return rows
  return rows.filter((row) => getMonthKeyFromDate(getDateField(row)) === monthKey)
}

export function paginateRows(rows, page, pageSize = TRACKING_PAGE_SIZE) {
  const totalItems = rows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    totalPages,
    totalItems,
    pageRows: rows.slice(start, start + pageSize),
  }
}

export function pickDefaultMonth(availableMonths) {
  if (!availableMonths.length) return ''
  const current = getCurrentMonthKey()
  return availableMonths.includes(current) ? current : availableMonths[0]
}
