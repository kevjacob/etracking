/**
 * Local-only storage for delivery orders. All data saved in localStorage on this machine.
 */

const STORAGE_KEY = 'etracking_delivery_orders'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadDeliveryOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveDeliveryOrders(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save delivery orders to localStorage:', e)
  }
}

export async function fetchDeliveryOrders() {
  return loadDeliveryOrders()
}

export async function insertDeliveryOrder(row) {
  const rows = loadDeliveryOrders()
  const id = generateId()
  const newRow = { ...row, id }
  rows.push(newRow)
  saveDeliveryOrders(rows)
  return newRow
}

export async function updateDeliveryOrder(id, row) {
  const rows = loadDeliveryOrders()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveDeliveryOrders(rows)
  return updated
}

export async function deleteDeliveryOrder(id) {
  const rows = loadDeliveryOrders().filter((r) => r.id !== id)
  saveDeliveryOrders(rows)
}
