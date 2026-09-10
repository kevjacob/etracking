# Supabase for eTracking

Use Supabase as the database backend instead of localStorage.

## Cloud-only setup (recommended)

Office LAN, Vercel, and mobile all use **one hosted Supabase project**. No Docker, no backup daemon, live updates everywhere.

1. **Create `.env`** in the project root (same keys as Vercel):

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

   Get these from [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings → API** (use the **anon public** key, not service_role).

2. **One-time cutover** (if you were on Docker + backup before):

   - Make sure cloud has the latest data: `npm run backup:mirror` (while Docker is still running and `.env` still points at local).
   - Update `.env` to the cloud URL and anon key above.
   - Stop the backup daemon if it is running (`Ctrl+C` on `npm run backup:daemon`).
   - Stop Docker: `npx supabase stop` (optional — you can leave Docker installed but unused).

3. **Start the app**:

   ```bash
   npm run dev
   ```

   Every device (office PCs, phones, Vercel) now reads and writes the **same** database. Changes appear in seconds via Realtime — no sync delay.

4. **Office LAN**: Other PCs can open `http://<host-IP>:5173` or the Vercel URL; both hit cloud Supabase. The host PC no longer needs Docker running for data.

5. **Migrations**: Hosted project must have the same schema as `supabase/migrations/`. Apply with `npx supabase db push` (linked project) or run the SQL files in the Dashboard SQL Editor. Realtime: run `supabase/migrations/20250303100000_enable_realtime.sql` on cloud if not already applied.

### What you can remove after cutover

| Old | New |
|-----|-----|
| `npx supabase start` (Docker) | Not needed |
| `npm run backup:daemon` | Not needed |
| `SUPABASE_REMOTE_*` in `.env` | Not needed (app talks to cloud directly) |
| Hourly / 90s sync delay | Instant (Realtime) |

Keep `npm run backup` only if you want occasional JSON export via **Settings → Import/Export**, not for sync.

---

## Local Docker (legacy / dev offline)

Use this only if you want a fully offline database on one PC.

1. **Start Supabase locally** (requires Docker):

   ```bash
   npx supabase start
   ```

   Migrations in `supabase/migrations/` run automatically. When it’s ready, the CLI prints the API URL and anon key.

2. **Create `.env`** in the project root (do not commit this file):

   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<paste the anon key from `npx supabase status`>
   ```

   To see the keys again: `npx supabase status`.

3. **Start the app**:

   ```bash
   npm run dev
   ```

   If both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, the app uses Supabase for all data (employees, warehouses, invoices, credit notes, GRN, delivery orders). Otherwise it falls back to localStorage.

## Access from other PCs on the network (Docker only)

With **cloud-only** setup, skip this section — any PC or phone uses the Vercel URL or `npm run dev`; data is always on Supabase cloud.

For **local Docker**, data lives on the PC that runs `npx supabase start`:

1. On the **host PC**, run `npx supabase start` and `npm run dev` (the dev server is already bound to all interfaces).
2. Find the host PC’s IP (e.g. `192.168.1.100` via `ipconfig` / `ifconfig`).
3. On the **other PC**, open the app at `http://<host-IP>:5173` (e.g. `http://192.168.1.100:5173`).

Use the host IP in the address bar on the other PC so it uses the same Supabase. Refresh to see updates (or use Realtime below for live updates).

## Live updates (Realtime)

When using Supabase, status and other row changes can appear **live** on all open tabs and devices—no refresh needed. Realtime is enabled by the migration `20250303100000_enable_realtime.sql` (tables are added to the `supabase_realtime` publication). If you started Supabase before that migration, run `npx supabase db reset` (wipes data) to apply it, or run this SQL once in Studio → SQL Editor:

```sql
alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.invoices_autocount;
alter publication supabase_realtime add table public.credit_notes;
alter publication supabase_realtime add table public.grn;
alter publication supabase_realtime add table public.delivery_orders;
```

(Skip any line if that table is already in the publication.)

## Stop local Supabase

```bash
npx supabase stop
```
