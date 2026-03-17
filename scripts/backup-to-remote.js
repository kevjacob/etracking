/**
 * Backup/sync data from local Supabase (Docker) to online Supabase.
 * Includes chat_messages. Run once per hour via run-backup-daemon.js or cron.
 *
 * Requires: .env with
 *   VITE_SUPABASE_URL (or SUPABASE_LOCAL_URL) + VITE_SUPABASE_ANON_KEY (or SUPABASE_LOCAL_ANON_KEY) = local Docker
 *   SUPABASE_REMOTE_URL + SUPABASE_REMOTE_SERVICE_ROLE_KEY = online project
 *
 * Run remote-schema.sql once in the online project SQL Editor before first sync.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const env = { ...process.env }
  const tryPaths = [
    resolve(__dirname, '../.env'),
    resolve(process.cwd(), '.env'),
  ]
  for (const envPath of tryPaths) {
    try {
      const content = readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (m) {
          let val = m[2].trim()
          const hash = val.indexOf('#')
          if (hash !== -1) val = val.slice(0, hash).trim()
          val = val.replace(/^["']|["']$/g, '')
          env[m[1].trim()] = val
        }
      }
      break
    } catch {
      continue
    }
  }
  return env
}

const env = loadEnv()

const localUrl = (env.SUPABASE_LOCAL_URL || env.VITE_SUPABASE_URL || '').trim()
const localKey = (env.SUPABASE_LOCAL_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()
const remoteUrl = (
  env.SUPABASE_REMOTE_URL ||
  env.REMOTE_SUPABASE_URL ||
  env.VITE_SUPABASE_REMOTE_URL ||
  ''
).trim()
const remoteKey = (
  env.SUPABASE_REMOTE_SERVICE_ROLE_KEY ||
  env.SUPABASE_REMOTE_ANON_KEY ||
  env.SUPABASE_REMOTE_KEY ||
  env.REMOTE_SUPABASE_SERVICE_ROLE_KEY ||
  env.REMOTE_SUPABASE_ANON_KEY ||
  ''
).trim()

if (!localUrl || !localKey) {
  console.error('Missing local Supabase. In the project root .env add:')
  console.error('  VITE_SUPABASE_URL=http://127.0.0.1:54321')
  console.error('  VITE_SUPABASE_ANON_KEY=<anon key from npx supabase status>')
  process.exit(1)
}
if (!remoteUrl || !remoteKey) {
  console.error('Missing remote Supabase. In .env set both:')
  console.error('  SUPABASE_REMOTE_URL=https://your-project.supabase.co')
  console.error('  SUPABASE_REMOTE_SERVICE_ROLE_KEY=<service_role key from Dashboard > Settings > API>')
  console.error('')
  console.error('(Script looked for SUPABASE_REMOTE_URL and SUPABASE_REMOTE_SERVICE_ROLE_KEY or SUPABASE_REMOTE_ANON_KEY.)')
  if (env.SUPABASE_REMOTE_URL !== undefined || env.SUPABASE_REMOTE_SERVICE_ROLE_KEY !== undefined) {
    console.error('URL present:', !!remoteUrl, '| Key present:', !!remoteKey)
  }
  process.exit(1)
}

const local = createClient(localUrl, localKey)
const remote = createClient(remoteUrl, remoteKey)

// Order: satisfy FKs. employees & warehouses first; then app_users, announcements; then the rest.
const TABLES = [
  'employees',
  'warehouses',
  'app_users',
  'announcements',
  'invoices',
  'invoices_autocount',
  'credit_notes',
  'grn',
  'delivery_orders',
  'chat_messages',
]

async function syncTable(table) {
  const { data: rows, error: fetchError } = await local.from(table).select('*')
  if (fetchError) {
    console.error(`[${table}] Local fetch error:`, fetchError.message)
    return { ok: false, count: 0 }
  }
  if (!rows || rows.length === 0) {
    return { ok: true, count: 0 }
  }
  const { error: upsertError } = await remote.from(table).upsert(rows, { onConflict: 'id' })
  if (upsertError) {
    console.error(`[${table}] Remote upsert error:`, upsertError.message)
    return { ok: false, count: rows.length }
  }
  return { ok: true, count: rows.length }
}

export async function runBackup() {
  const started = new Date().toISOString()
  console.log(`[backup] Started at ${started}`)
  let total = 0
  for (const table of TABLES) {
    const result = await syncTable(table)
    if (result.ok) {
      total += result.count
      if (result.count > 0) console.log(`[backup] ${table}: ${result.count} rows`)
    }
  }
  console.log(`[backup] Done at ${new Date().toISOString()} (${total} rows total)`)
  return total
}

runBackup().catch((err) => {
  console.error('[backup] Fatal:', err)
  process.exit(1)
})
