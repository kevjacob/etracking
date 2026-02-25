import { supabase } from '../supabaseClient'

function toDateStr(v) {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  return v
}

function mapFromDb(row) {
  if (!row) return null
  return {
    id: row.id,
    invoiceNo: row.invoice_no || '',
    dateOfInvoice: toDateStr(row.date_of_invoice),
    status: row.status || 'Billed',
    assignedDriverId: row.assigned_driver_id || null,
    assignedSalesmanId: row.assigned_salesman_id || null,
    assignedClerkId: row.assigned_clerk_id || null,
    transferWarehouseId: row.transfer_warehouse_id || null,
    holdWarehouseId: row.hold_warehouse_id || null,
    holdWarehouseType: row.hold_warehouse_type || '',
    deliveryDate: toDateStr(row.delivery_date),
    deliverySlot: row.delivery_slot || '',
    remark: row.remark || '',
    discrepancy: {
      checked: row.discrepancy_checked ?? false,
      title: row.discrepancy_title || '',
      description: row.discrepancy_description || '',
    },
  }
}

function mapToDb(row) {
  return {
    invoice_no: row.invoiceNo ?? '',
    date_of_invoice: row.dateOfInvoice || null,
    status: row.status ?? 'Billed',
    assigned_driver_id: row.assignedDriverId || null,
    assigned_salesman_id: row.assignedSalesmanId || null,
    assigned_clerk_id: row.assignedClerkId || null,
    transfer_warehouse_id: row.transferWarehouseId || null,
    hold_warehouse_id: row.holdWarehouseId || null,
    hold_warehouse_type: row.holdWarehouseType || '',
    delivery_date: row.deliveryDate || null,
    delivery_slot: row.deliverySlot || '',
    remark: row.remark ?? '',
    discrepancy_checked: row.discrepancy?.checked ?? false,
    discrepancy_title: row.discrepancy?.title ?? '',
    discrepancy_description: row.discrepancy?.description ?? '',
    updated_at: new Date().toISOString(),
  }
}

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapFromDb)
}

export async function insertInvoice(row) {
  const payload = mapToDb(row)
  const { data, error } = await supabase
    .from('invoices')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return mapFromDb(data)
}

export async function updateInvoice(id, updates) {
  const payload = mapToDb(updates)
  const { data, error } = await supabase
    .from('invoices')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapFromDb(data)
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}
