import { insertStatusHistory } from '../api/statusHistory'

const USER_STORAGE_KEY = 'etracking_user'

function currentEditorName() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return ''
    const user = JSON.parse(raw)
    return String(user?.name || user?.username || '').trim()
  } catch {
    return ''
  }
}

/**
 * Log a workflow status change for Lead Time Aging Report.
 * @param {object} prevRow - row before update (must have status, statusUpdatedAt, id)
 * @param {string|undefined} nextStatus - new status from updates
 * @param {{ entityType: string, getDocumentNo?: (row: object) => string }} meta
 */
export function recordStatusTransition(prevRow, nextStatus, meta) {
  if (!prevRow || nextStatus === undefined || nextStatus === prevRow.status) return
  const documentNo = meta.getDocumentNo ? meta.getDocumentNo(prevRow) : prevRow.documentNo || ''
  const fromStatusAt = prevRow.statusUpdatedAt || new Date().toISOString()
  const toStatusAt = new Date().toISOString()
  insertStatusHistory({
    entityType: meta.entityType,
    entityId: prevRow.id,
    documentNo: String(documentNo || '').trim(),
    fromStatus: prevRow.status || '',
    toStatus: nextStatus,
    fromStatusAt,
    toStatusAt,
    editedBy: currentEditorName(),
  }).catch((e) => console.error('Status history log error:', e))
}

/** Log initial Billed (or other) status when a document is first created/imported. */
export function recordInitialStatus({ entityType, entityId, documentNo, status, statusAt }) {
  const at = statusAt || new Date().toISOString()
  insertStatusHistory({
    entityType,
    entityId,
    documentNo: String(documentNo || '').trim(),
    fromStatus: '(New)',
    toStatus: status,
    fromStatusAt: at,
    toStatusAt: at,
    editedBy: currentEditorName(),
  }).catch((e) => console.error('Status history initial log error:', e))
}
