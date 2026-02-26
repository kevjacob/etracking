/**
 * Local-only storage for credit notes. All data saved in localStorage on this machine.
 */

const STORAGE_KEY = 'etracking_credit_notes'

function generateId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

function loadCreditNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveCreditNotes(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch (e) {
    console.error('Failed to save credit notes to localStorage:', e)
  }
}

export async function fetchCreditNotes() {
  return loadCreditNotes()
}

export async function insertCreditNote(row) {
  const rows = loadCreditNotes()
  const id = generateId()
  const newRow = { ...row, id }
  rows.push(newRow)
  saveCreditNotes(rows)
  return newRow
}

export async function updateCreditNote(id, row) {
  const rows = loadCreditNotes()
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return row
  const updated = { ...rows[index], ...row, id }
  rows[index] = updated
  saveCreditNotes(rows)
  return updated
}

export async function deleteCreditNote(id) {
  const rows = loadCreditNotes().filter((r) => r.id !== id)
  saveCreditNotes(rows)
}
