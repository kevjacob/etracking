# Supabase (Docker) for eTracking

Use Supabase as the database backend instead of localStorage.

## Quick start

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

## Access from other PCs on the network

Data is in the Supabase Docker stack on the **PC that runs `npx supabase start`**. To use the app from another device on the same LAN:

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

## Hosted Supabase

Use your project’s API URL and anon key in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Migrations must be applied to the hosted project (e.g. `npx supabase db push` or run the SQL in `supabase/migrations/` in the SQL editor).

## Stop local Supabase

```bash
npx supabase stop
```
