/**
 * Backup/sync data from local Supabase (Docker) to online Supabase.
 * Includes chat_messages. Run once per hour via run-backup-daemon.js or cron.
 *
 * Requires: .env with
 *   Local: VITE_SUPABASE_URL + SUPABASE_LOCAL_SERVICE_ROLE_KEY (from npx supabase status; needed to read app_users)
 *   Remote: SUPABASE_REMOTE_URL + SUPABASE_REMOTE_SERVICE_ROLE_KEY (or anon key) = online project
 *
 * Run remote-schema.sql once in the online project SQL Editor before first sync.
 * If local Kong is unreachable, docker-restarts supabase_kong_* and retries
 * (disable with BACKUP_AUTO_RESTART_KONG=0).
 */

import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const AUTO_RESTART_KONG = process.env.BACKUP_AUTO_RESTART_KONG !== '0'

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
          val = val.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim() // strip quotes/newlines, collapse spaces
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
// Prefer service_role for local so we can read app_users (RLS on Docker blocks anon from selecting app_users)
const localKeyRaw = env.SUPABASE_LOCAL_SERVICE_ROLE_KEY || env.SUPABASE_LOCAL_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
const localKeySource = env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ? 'SUPABASE_LOCAL_SERVICE_ROLE_KEY' : env.SUPABASE_LOCAL_ANON_KEY ? 'SUPABASE_LOCAL_ANON_KEY' : 'VITE_SUPABASE_ANON_KEY'
const localKey = localKeyRaw.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim()
const remoteUrl = (
  env.SUPABASE_REMOTE_URL ||
  env.REMOTE_SUPABASE_URL ||
  env.VITE_SUPABASE_REMOTE_URL ||
  ''
).trim()
const remoteKeyRaw = env.SUPABASE_REMOTE_SERVICE_ROLE_KEY || env.SUPABASE_REMOTE_ANON_KEY || env.SUPABASE_REMOTE_KEY || env.REMOTE_SUPABASE_SERVICE_ROLE_KEY || env.REMOTE_SUPABASE_ANON_KEY || ''
const remoteKeySource = env.SUPABASE_REMOTE_SERVICE_ROLE_KEY ? 'SUPABASE_REMOTE_SERVICE_ROLE_KEY' : env.SUPABASE_REMOTE_ANON_KEY ? 'SUPABASE_REMOTE_ANON_KEY' : env.SUPABASE_REMOTE_KEY ? 'SUPABASE_REMOTE_KEY' : env.REMOTE_SUPABASE_SERVICE_ROLE_KEY ? 'REMOTE_SUPABASE_SERVICE_ROLE_KEY' : 'REMOTE_SUPABASE_ANON_KEY'
const remoteKey = remoteKeyRaw.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim()

if (!localUrl || !localKey) {
  console.error('Missing local Supabase. In the project root .env add:')
  console.error('  VITE_SUPABASE_URL=http://127.0.0.1:54321')
  console.error('  SUPABASE_LOCAL_SERVICE_ROLE_KEY=<service_role key from npx supabase status>')
  console.error('  (Or VITE_SUPABASE_ANON_KEY for anon; service_role is needed to backup app_users.)')
  process.exit(1)
}
// JWT keys must have 3 parts (header.payload.signature). Truncated or multi-line paste causes "Expected 3 parts in JWT".
const localKeyParts = localKey.split('.')
if (localKeyParts.length !== 3) {
  console.error('Invalid local key: must be a full JWT (exactly 3 parts separated by dots).')
  console.error('  Read from:', localKeySource)
  console.error('  Length:', localKey.length, '| Parts:', localKeyParts.length)
  if (localKey.length > 0) {
    const preview = localKey.length <= 60 ? localKey : localKey.slice(0, 40) + '...' + localKey.slice(-20)
    console.error('  Value:', preview)
  }
  console.error('Get the key with: npx supabase status -o env   then copy SERVICE_ROLE_KEY= (starts with eyJ).')
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
const remoteKeyParts = remoteKey.split('.')
if (remoteKeyParts.length !== 3) {
  console.error('Invalid remote key: must be a full JWT (exactly 3 parts separated by dots).')
  console.error('  Read from:', remoteKeySource)
  console.error('  Length:', remoteKey.length, '| Parts:', remoteKeyParts.length)
  if (remoteKey.length > 0) {
    const preview = remoteKey.length <= 60 ? remoteKey : remoteKey.slice(0, 40) + '...' + remoteKey.slice(-20)
    console.error('  Value:', preview)
  }
  console.error('In Dashboard: Project Settings > API > Project API keys. Use "service_role" or "anon" (the long key starting with eyJ).')
  console.error('Do NOT use "Publishable" or "Secret" (sb_publishable_... / sb_secret_...) — those are not JWTs.')
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
  'grc',
  'delivery_orders',
  'chat_messages',
  'status_history',
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorText(err) {
  if (!err) return ''
  return [err.message, err.cause?.message, err.cause?.code, err.details].filter(Boolean).join(' ')
}

function isTransientError(err) {
  return /fetch failed|UND_ERR_SOCKET|other side closed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|socket hang up|Empty reply/i.test(errorText(err))
}

async function withRetry(label, fn, { retries = 3, delayMs = 800 } = {}) {
  let last
  for (let attempt = 1; attempt <= retries; attempt++) {
    last = await fn()
    if (!last?.error) return last
    if (!isTransientError(last.error) || attempt === retries) return last
    const wait = delayMs * attempt
    console.warn(`[${label}] Transient error, retry ${attempt}/${retries} in ${wait}ms: ${errorText(last.error)}`)
    await sleep(wait)
  }
  return last
}

async function docker(args, timeout = 20000) {
  const { stdout, stderr } = await execFileAsync('docker', args, { timeout, windowsHide: true })
  return { stdout: String(stdout).trim(), stderr: String(stderr).trim() }
}

async function findKongContainer() {
  const { stdout } = await docker(['ps', '-a', '--filter', 'name=supabase_kong', '--format', '{{.Names}}'])
  return stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || null
}

async function restartKong() {
  const name = await findKongContainer()
  if (!name) {
    console.error('[backup] No supabase_kong container found. Is Docker running?')
    return false
  }
  console.log(`[backup] Restarting ${name} to restore local API...`)
  await docker(['restart', name], 90000)
  return true
}

async function probeLocalOnce() {
  const url = `${localUrl.replace(/\/$/, '')}/auth/v1/health`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    return res.ok || res.status === 401
  } catch {
    return false
  }
}

async function probeLocal({ attempts = 3 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (await probeLocalOnce()) return true
    console.warn(`[backup] Local Supabase unreachable (attempt ${attempt}/${attempts})`)
    if (attempt < attempts) await sleep(1500 * attempt)
  }
  return false
}

async function waitForLocal({ timeoutMs = 60000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let n = 0
  while (Date.now() < deadline) {
    n += 1
    if (await probeLocalOnce()) {
      console.log('[backup] Local API is reachable again')
      return true
    }
    console.log(`[backup] Waiting for Kong to come back (${n})...`)
    await sleep(intervalMs)
  }
  return false
}

async function recoverLocalApi() {
  if (!AUTO_RESTART_KONG) return false
  try {
    if (!(await restartKong())) return false
  } catch (err) {
    console.error('[backup] Docker restart failed:', errorText(err) || err.message)
    return false
  }
  return waitForLocal()
}

async function ensureLocalApi() {
  if (await probeLocal()) return true
  console.warn('[backup] Local API unreachable (stale Docker port-forward). Auto-restarting Kong...')
  if (await recoverLocalApi()) return true
  console.error(`[backup] Local API at ${localUrl} still unreachable after Kong restart.`)
  return false
}

async function syncTable(table) {
  const { data: rows, error: fetchError } = await withRetry(table, () => local.from(table).select('*'))
  if (fetchError) {
    console.error(`[${table}] Local fetch error:`, errorText(fetchError))
    return { ok: false, count: 0, transientLocal: isTransientError(fetchError) }
  }
  if (!rows || rows.length === 0) {
    return { ok: true, count: 0, transientLocal: false }
  }
  const { error: upsertError } = await withRetry(`${table}:remote`, () =>
    remote.from(table).upsert(rows, { onConflict: 'id' })
  )
  if (upsertError) {
    console.error(`[${table}] Remote upsert error:`, errorText(upsertError))
    return { ok: false, count: rows.length, transientLocal: false }
  }
  return { ok: true, count: rows.length, transientLocal: false }
}

async function syncAllTables() {
  let total = 0
  const failed = []
  let transientLocal = false
  for (const table of TABLES) {
    const result = await syncTable(table)
    if (result.ok) {
      total += result.count
      if (result.count > 0) console.log(`[backup] ${table}: ${result.count} rows`)
    } else {
      failed.push(table)
      if (result.transientLocal) transientLocal = true
    }
  }
  return { total, failed, transientLocal }
}

function logBackupResult(total, failed) {
  if (failed.length) {
    console.error(`[backup] Failed tables: ${failed.join(', ')}`)
  }
  const failedNote = failed.length ? `, ${failed.length} failed` : ''
  console.log(`[backup] Done at ${new Date().toISOString()} (${total} rows total${failedNote})`)
}

export async function runBackup() {
  const started = new Date().toISOString()
  console.log(`[backup] Started at ${started}`)
  if (!(await ensureLocalApi())) {
    console.log(`[backup] Skipped at ${new Date().toISOString()} (local API unreachable)`)
    return 0
  }
  let { total, failed, transientLocal } = await syncAllTables()
  if (failed.length && transientLocal) {
    console.warn('[backup] Local fetches failed. Restarting Kong and retrying...')
    if (await recoverLocalApi()) {
      ;({ total, failed } = await syncAllTables())
    }
  }
  logBackupResult(total, failed)
  return total
}

// Only auto-run when executed directly (`npm run backup`), not when imported by the daemon.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isDirectRun) {
  runBackup().catch((err) => {
    console.error('[backup] Fatal:', err)
    process.exit(1)
  })
}
