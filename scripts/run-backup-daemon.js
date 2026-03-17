/**
 * Runs backup-to-remote.js once, then every 1 hour.
 * Keep this process running while Docker is online (e.g. in a separate terminal or as a service).
 *
 * node scripts/run-backup-daemon.js
 */

import { runBackup } from './backup-to-remote.js'

const INTERVAL_MS = 60 * 60 * 1000 // 1 hour

async function loop() {
  await runBackup()
  setInterval(runBackup, INTERVAL_MS)
  console.log(`[daemon] Next backup in 1 hour`)
}

loop().catch((err) => {
  console.error('[daemon] Fatal:', err)
  process.exit(1)
})
