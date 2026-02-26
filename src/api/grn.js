/**
 * Local-only storage for GRN (Goods Received Note). All data saved in localStorage on this machine.
 */

const STORAGE_KEY = 'etracking_grn'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadGRNs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveGRNs(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save GRN to localStorage:', e)
  }
}

export async function fetchGRNs() {
  return loadGRNs()
}

export async function insertGRN(row) {
  const rows = loadGRNs()
  const id = generateId()
  const newRow = { ...row, id }
  rows.push(newRow)
  saveGRNs(rows)
  return newRow
}

export async function updateGRN(id, row) {
  const rows = loadGRNs()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveGRNs(rows)
  return updated
}

export async function deleteGRN(id) {
  const rows = loadGRNs().filter((r) => r.id !== id)
  saveGRNs(rows)
}
