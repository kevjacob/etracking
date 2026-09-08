/** Additional remark stored in row.discrepancy (legacy field name). */

export function defaultAdditionalRemark() {
  return { checked: false, title: '', description: '' }
}

export function getAdditionalRemarkText(discrepancy) {
  if (!discrepancy?.checked) return ''
  const description = (discrepancy.description || '').trim()
  const title = (discrepancy.title || '').trim()
  if (description) return description
  return title
}

export function hasAdditionalRemark(discrepancy) {
  return Boolean(getAdditionalRemarkText(discrepancy))
}

export function saveAdditionalRemark(remark) {
  const text = (remark || '').trim()
  if (!text) return defaultAdditionalRemark()
  return { checked: true, title: '', description: text }
}
