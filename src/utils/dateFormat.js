/** Format Date for display: dd/mm/yyyy */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/** Parse dd/mm/yyyy or yyyy-mm-dd to yyyy-mm-dd for input[type=date] */
export function toInputDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split(/[/-]/)
  if (parts.length !== 3) return ''
  const [a, b, c] = parts
  if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}` // already yyyy-mm-dd
  const day = a.padStart(2, '0')
  const month = b.padStart(2, '0')
  const year = (c.length === 2 ? `20${c}` : c).padStart(4, '0')
  return `${year}-${month}-${day}`
}

/** Parse yyyy-mm-dd or dd/mm/yyyy to ISO date string */
export function parseDate(value) {
  if (!value) return ''
  if (value.includes('/')) {
    const [d, m, y] = value.split('/')
    const year = (y.length === 2 ? `20${y}` : y).padStart(4, '0')
    const month = m.padStart(2, '0')
    const day = d.padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return value
}
