/**
 * Runs backup-to-remote.js on a loop (upsert local → cloud).
 * Default: every 90 seconds. Override with BACKUP_INTERVAL_MS in .env
 * (e.g. BACKUP_INTERVAL_MS=3600000 for hourly).
 *
 * Mirror mode (deletes remote-only rows) is NOT run here — use npm run backup:mirror manually.
 *
 * node scripts/run-backup-daemon.js
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { runBackup } from './backup-to-remote.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadIntervalMs() {
  const tryPaths = [resolve(__dirname, '../.env'), resolve(process.cwd(), '.env')]
  for (const envPath of tryPaths) {
    try {
      const content = readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n')
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*BACKUP_INTERVAL_MS\s*=\s*(.*)$/)
        if (m) {
          const val = Number(m[1].trim().replace(/#.*$/, ''))
          if (!Number.isNaN(val) && val >= 15000) return val
        }
      }
      break
    } catch {
      continue
    }
  }
  const fromProcess = Number(process.env.BACKUP_INTERVAL_MS)
  if (!Number.isNaN(fromProcess) && fromProcess >= 15000) return fromProcess
  return 90 * 1000 // 90 seconds — near-real-time upsert sync
}

const INTERVAL_MS = loadIntervalMs()

function formatInterval(ms) {
  if (ms % 3600000 === 0) return `${ms / 3600000} hour(s)`
  if (ms % 60000 === 0) return `${ms / 60000} minute(s)`
  return `${Math.round(ms / 1000)} second(s)`
}

async function tick() {
  try {
    await runBackup()
  } catch (err) {
    console.error('[daemon] Backup failed:', err)
  }
  console.log(`[daemon] Next backup in ${formatInterval(INTERVAL_MS)}`)
  setTimeout(tick, INTERVAL_MS)
}

console.log(`[daemon] Backup sync every ${formatInterval(INTERVAL_MS)} (upsert only, not mirror)`)
tick().catch((err) => {
  console.error('[daemon] Fatal:', err)
  process.exit(1)
})
