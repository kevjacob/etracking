/** Remark segments use " / " as separator (e.g. "Self Collect / Chop & Sign"). */

function splitRemarkParts(remark) {
  if (!remark || typeof remark !== 'string') return []
  return remark
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function dedupeRemarkParts(parts) {
  const seen = new Set()
  const out = []
  for (const part of parts) {
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(part)
  }
  return out
}

export function hasSelfCollectInRemark(remark) {
  return splitRemarkParts(remark).some((part) => part.toLowerCase() === 'self collect')
}

export function hasChopSignInRemark(remark) {
  return splitRemarkParts(remark).some((part) => part.toLowerCase() === 'chop & sign')
}

export function removeSelfCollectFromRemark(remark) {
  const parts = splitRemarkParts(remark).filter((p) => p.toLowerCase() !== 'self collect')
  return parts.join(' / ')
}

export function removeChopSignFromRemark(remark) {
  return splitRemarkParts(remark).filter((p) => p.toLowerCase() !== 'chop & sign').join(' / ')
}

export function isChopSignStatus(status) {
  return typeof status === 'string' && status.startsWith('Chop & Sign -')
}

const KEEP_CHOP_SIGN_REMARK_STATUSES = new Set(['Delivered', 'Cancelled'])

/** When leaving a Chop & Sign status, strip Chop & Sign from remark unless moving to Delivered/Cancelled or another Chop & Sign status. */
export function remarkAfterLeavingChopSignStatus(remark, previousStatus, newStatus) {
  if (!isChopSignStatus(previousStatus)) return remark ?? ''
  if (KEEP_CHOP_SIGN_REMARK_STATUSES.has(newStatus)) return remark ?? ''
  if (isChopSignStatus(newStatus)) return remark ?? ''
  return removeChopSignFromRemark(remark ?? '')
}

/** Payload fragment `{ remark }` when remark should change, else `{}`. */
export function leavingChopSignRemarkPayload(previousStatus, newStatus, remark) {
  const next = remarkAfterLeavingChopSignStatus(remark, previousStatus, newStatus)
  const current = remark ?? ''
  if (next === current) return {}
  return { remark: next }
}

export function appendChopSignToRemark(remark, { removeSelfCollect = false } = {}) {
  let parts = splitRemarkParts(remark)
  if (removeSelfCollect) {
    parts = parts.filter((p) => p.toLowerCase() !== 'self collect')
  }
  if (parts.some((p) => p.toLowerCase() === 'chop & sign')) {
    return dedupeRemarkParts(parts).join(' / ')
  }
  parts = dedupeRemarkParts(parts)
  const base = parts.join(' / ')
  return base ? `${base} / Chop & Sign` : 'Chop & Sign'
}
