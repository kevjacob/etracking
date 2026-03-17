/**
 * Shared logic for "on alert" (status exceeded allowed duration).
 * Used by Home page alert boxes and matches Invoice/GRN/DO tracking pages.
 */
const PHASE_1 = ['Billed']
const PHASE_2 = [
  'Preparing Delivery',
  'Hold - Office',
  'Hold - Warehouse',
  'Hold - Salesman',
  'Chop & Sign - Office',
  'Chop & Sign - Warehouse',
  'Chop & Sign - Salesman',
  'Transfer',
]
const PHASE_3 = ['Delivery In Progress']
const PHASE_4 = ['Delivered']
const PHASE_5 = ['Completed', 'Cancelled']

function getStatusMaxDays(status) {
  if (status === 'Cancelled') return 999
  if (PHASE_1.includes(status)) return 1
  if (status === 'Preparing Delivery') return 3
  if (PHASE_2.includes(status)) return 4
  if (PHASE_3.includes(status)) return 1.5
  if (PHASE_4.includes(status)) return 1
  if (PHASE_5.includes(status)) return 1
  return 1
}

export function isStatusOverdue(row) {
  const updatedAt = row?.statusUpdatedAt
  if (!updatedAt) return false
  const updated = new Date(updatedAt).getTime()
  const now = Date.now()
  const maxDays = getStatusMaxDays(row.status)
  const maxMs = maxDays * 24 * 60 * 60 * 1000
  return now - updated > maxMs
}
