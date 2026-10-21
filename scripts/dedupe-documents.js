/**
 * Remove duplicate ESD / Autocount invoices and credit notes.
 * Keeps the row with the most advanced status; ties use earliest created_at.
 *
 *   node scripts/dedupe-documents.js          # dry run
 *   node scripts/dedupe-documents.js --apply  # delete extras
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const APPLY = process.argv.includes('--apply')
const PAGE_SIZE = 1000

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const env = { ...process.env }
  const tryPaths = [resolve(__dirname, '../.env'), resolve(process.cwd(), '.env')]
  for (const envPath of tryPaths) {
    try {
      const content = readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (m) {
          let val = m[2].trim()
          const hash = val.indexOf('#')
          if (hash !== -1) val = val.slice(0, hash).trim()
          env[m[1].trim()] = val.replace(/^["'\s]+|["'\s]+$/g, '').trim()
        }
      }
      break
    } catch {
      continue
    }
  }
  return env
}

const STATUS_RANK = {
  Completed: 100,
  Cancelled: 99,
  Delivered: 90,
  'Delivery In Progress': 80,
  'Preparing Delivery': 70,
  'Chop & Sign - Warehouse': 62,
  'Chop & Sign - Office': 61,
  'Chop & Sign - Salesman': 60,
  'Hold - Warehouse': 52,
  'Hold - Office': 51,
  'Hold - Salesman': 50,
  Transfer: 40,
  Billed: 10,
}

function normalizeNo(value) {
  return String(value || '').trim()
}

function statusRank(status) {
  return STATUS_RANK[String(status || '').trim()] ?? 5
}

function progressScore(row) {
  let score = 0
  if (row.assigned_driver_id) score += 1
  if (row.assigned_salesman_id) score += 1
  if (row.assigned_clerk_id) score += 1
  if (row.delivery_date) score += 1
  if (String(row.remark || '').trim()) score += 1
  if (row.hold_warehouse_id || row.transfer_warehouse_id) score += 1
  return score
}

function pickKeep(a, b) {
  const rankDiff = statusRank(b.status) - statusRank(a.status)
  if (rankDiff !== 0) return rankDiff > 0 ? b : a
  const progressDiff = progressScore(b) - progressScore(a)
  if (progressDiff !== 0) return progressDiff > 0 ? b : a
  const aCreated = a.created_at || ''
  const bCreated = b.created_at || ''
  if (aCreated !== bCreated) return aCreated <= bCreated ? a : b
  return String(a.id) <= String(b.id) ? a : b
}

async function fetchAll(client, table, columns) {
  const all = []
  let from = 0
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

function findDuplicates(rows, noField) {
  const groups = new Map()
  for (const row of rows) {
    const no = normalizeNo(row[noField])
    if (!no) continue
    const list = groups.get(no) || []
    list.push(row)
    groups.set(no, list)
  }
  const duplicates = []
  for (const [no, list] of groups) {
    if (list.length < 2) continue
    let keep = list[0]
    for (let i = 1; i < list.length; i++) keep = pickKeep(keep, list[i])
    duplicates.push({
      no,
      keepId: keep.id,
      keepStatus: keep.status,
      deleteIds: list.filter((r) => r.id !== keep.id).map((r) => r.id),
    })
  }
  return duplicates
}

async function deleteByIds(client, table, ids) {
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const { error, count } = await client.from(table).delete({ count: 'exact' }).in('id', batch)
    if (error) throw error
    deleted += count ?? batch.length
  }
  return deleted
}

async function deleteStatusHistory(client, entityType, ids) {
  if (!ids.length) return 0
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100).map(String)
    const { error, count } = await client
      .from('status_history')
      .delete({ count: 'exact' })
      .eq('entity_type', entityType)
      .in('entity_id', batch)
    if (error) {
      console.warn(`status_history cleanup skipped for ${entityType}: ${error.message}`)
      return deleted
    }
    deleted += count ?? 0
  }
  return deleted
}

async function processTable(client, { table, noField, entityType, label }) {
  const rows = await fetchAll(
    client,
    table,
    `id, ${noField}, status, created_at, assigned_driver_id, assigned_salesman_id, assigned_clerk_id, delivery_date, remark, hold_warehouse_id, transfer_warehouse_id`
  )
  const duplicates = findDuplicates(rows, noField)
  const deleteIds = duplicates.flatMap((d) => d.deleteIds)
  console.log(`${label}: ${rows.length} rows, ${duplicates.length} duplicate number(s), ${deleteIds.length} extra row(s)`)
  for (const d of duplicates.slice(0, 30)) {
    console.log(`  ${d.no}: keep ${d.keepStatus} (${d.keepId}), delete ${d.deleteIds.length}`)
  }
  if (duplicates.length > 30) console.log(`  … and ${duplicates.length - 30} more`)
  if (!APPLY || !deleteIds.length) return { deleteIds: deleteIds.length, history: 0 }
  const deleted = await deleteByIds(client, table, deleteIds)
  const history = await deleteStatusHistory(client, entityType, deleteIds)
  console.log(`  deleted ${deleted} row(s), ${history} status history row(s)`)
  return { deleteIds: deleted, history }
}

async function main() {
  const env = loadEnv()
  const url = (env.VITE_SUPABASE_URL || '').trim()
  const key = (env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
    process.exit(1)
  }

  const client = createClient(url, key)
  console.log(APPLY ? 'Applying duplicate cleanup…' : 'Dry run (no deletes). Pass --apply to delete extras.')

  await processTable(client, {
    table: 'invoices',
    noField: 'invoice_no',
    entityType: 'esd_invoice',
    label: 'ESD invoices',
  })
  await processTable(client, {
    table: 'invoices_autocount',
    noField: 'invoice_no',
    entityType: 'autocount_invoice',
    label: 'Autocount invoices',
  })
  await processTable(client, {
    table: 'credit_notes',
    noField: 'credit_note_no',
    entityType: 'credit_note',
    label: 'Credit notes',
  })
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
