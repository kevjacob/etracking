/**
 * Entity types for status history (Lead Time Aging Report).
 */
export const STATUS_HISTORY_ENTITY_TYPES = [
  { value: 'esd_invoice', label: 'ESD Invoice' },
  { value: 'autocount_invoice', label: 'Autocount Invoice' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'delivery_order', label: 'Delivery Order' },
  { value: 'grn', label: 'GRN' },
  { value: 'grc', label: 'GRC' },
  { value: 'idt', label: 'IDT' },
]

export const LEAD_TIME_BUCKETS = [
  { key: '1-3', label: '1–3 days', min: 0, max: 3 },
  { key: '4-7', label: '4–7 days', min: 4, max: 7 },
  { key: '8-10', label: '8–10 days', min: 8, max: 10 },
  { key: '11-14', label: '11–14 days', min: 11, max: 14 },
  { key: '15+', label: '15+ days', min: 15, max: Infinity },
]

export function bucketForDays(days) {
  const d = Number(days)
  if (Number.isNaN(d) || d < 0) return null
  for (const b of LEAD_TIME_BUCKETS) {
    if (d >= b.min && d <= b.max) return b.key
  }
  return null
}
