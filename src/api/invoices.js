/**
 * Local-only storage for invoices. All data saved in localStorage on this machine.
 * No Supabase or network. Use this while building; add Supabase later when ready.
 */

const STORAGE_KEY = 'etracking_invoices'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadInvoices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveInvoices(invoices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices))
  } catch (e) {
    console.error('Failed to save invoices to localStorage:', e)
  }
}

export async function fetchInvoices() {
  return loadInvoices()
}

export async function insertInvoice(row) {
  const invoices = loadInvoices()
  const id = generateId()
  const newRow = { ...row, id }
  invoices.push(newRow)
  saveInvoices(invoices)
  return newRow
}

export async function updateInvoice(id, row) {
  const invoices = loadInvoices()
  const index = invoices.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...invoices[index], ...row, id }
  invoices[index] = updated
  saveInvoices(invoices)
  return updated
}

export async function deleteInvoice(id) {
  const invoices = loadInvoices().filter((r) => r.id !== id)
  saveInvoices(invoices)
}
