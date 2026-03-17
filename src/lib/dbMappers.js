/**
 * Map between app (camelCase) and Supabase (snake_case) row shapes.
 * Used by API modules when reading/writing to Supabase.
 */

const SNAKE_MAP = {
  invoiceNo: 'invoice_no',
  dateOfInvoice: 'date_of_invoice',
  statusUpdatedAt: 'status_updated_at',
  assignedDriverId: 'assigned_driver_id',
  assignedSalesmanId: 'assigned_salesman_id',
  assignedClerkId: 'assigned_clerk_id',
  transferWarehouseId: 'transfer_warehouse_id',
  holdWarehouseId: 'hold_warehouse_id',
  holdWarehouseType: 'hold_warehouse_type',
  deliveryDate: 'delivery_date',
  deliverySlot: 'delivery_slot',
  remarkAtBilled: 'remark_at_billed',
  creditNoteNo: 'credit_note_no',
  creditNoteDate: 'credit_note_date',
  numberAndDateLocked: 'number_and_date_locked',
  grnNo: 'grn_no',
  grnDate: 'grn_date',
  deliveryOrderNo: 'delivery_order_no',
  deliveryOrderDate: 'delivery_order_date',
  picName: 'pic_name',
  picPhone: 'pic_phone',
  userId: 'user_id',
  createdAt: 'created_at',
}

const CAMEL_MAP = {}
for (const [k, v] of Object.entries(SNAKE_MAP)) {
  CAMEL_MAP[v] = k
}

// Postgres date columns: empty string is invalid, use null
const DATE_COLUMNS = new Set([
  'date_of_invoice',
  'delivery_date',
  'credit_note_date',
  'grn_date',
  'delivery_order_date',
])

function toSnakeCase(obj) {
  if (obj == null || typeof obj !== 'object') return obj
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    const snake = SNAKE_MAP[key] ?? key
    if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      out[snake] = toSnakeCase(value)
    } else {
      let v = value
      if (DATE_COLUMNS.has(snake) && (v === '' || v === undefined)) v = null
      out[snake] = v
    }
  }
  return out
}

function fromSnakeCase(obj) {
  if (obj == null || typeof obj !== 'object') return obj
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    const camel = CAMEL_MAP[key] ?? key
    if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      out[camel] = fromSnakeCase(value)
    } else {
      out[camel] = value
    }
  }
  return out
}

export { toSnakeCase, fromSnakeCase }
