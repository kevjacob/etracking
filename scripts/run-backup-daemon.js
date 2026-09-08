/**
 * Runs backup-to-remote.js once, then every 1 hour.
 * If local Kong/port-forward dies (WSL upgrade, Docker hiccup), the backup
 * auto-restarts the supabase_kong container and retries.
 *
 * node scripts/run-backup-daemon.js
 */

import { runBackup } from './backup-to-remote.js'

const INTERVAL_MS = 60 * 60 * 1000 // 1 hour

async function tick() {
  try {
    await runBackup()
  } catch (err) {
    console.error('[daemon] Backup failed:', err)
  }
  console.log(`[daemon] Next backup in 1 hour`)
  setTimeout(tick, INTERVAL_MS)
}

tick().catch((err) => {
  console.error('[daemon] Fatal:', err)
  process.exit(1)
})
