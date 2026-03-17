/**
 * Sort key for document serial numbers (e.g. IV-001, CN-002, 31000001, GRN-001).
 * Uses the numeric part for ordering so 2 comes before 10.
 */
export function getSerialSortKey(str) {
  if (str == null) return [0, '']
  const s = String(str).trim()
  if (s === '') return [0, '']
  if (/^\d+$/.test(s)) return [0, parseInt(s, 10)]
  const matches = s.match(/\d+/g)
  const lastNum = matches && matches.length ? parseInt(matches[matches.length - 1], 10) : 0
  return [0, lastNum, s]
}

export function compareSerial(a, b) {
  const ka = getSerialSortKey(a)
  const kb = getSerialSortKey(b)
  if (ka[1] !== kb[1]) return (ka[1] || 0) - (kb[1] || 0)
  return String(ka[2] || '').localeCompare(String(kb[2] || ''))
}

/**
 * Sort an array of items by a string field in serial numeric order.
 */
export function sortBySerial(items, getField) {
  if (!items || !items.length) return items
  const getKey = (item) => getSerialSortKey(getField(item))
  return [...items].sort((a, b) => {
    const ka = getKey(a)
    const kb = getKey(b)
    if (ka[1] !== kb[1]) return (ka[1] || 0) - (kb[1] || 0)
    return String(ka[2] || '').localeCompare(String(kb[2] || ''))
  })
}
