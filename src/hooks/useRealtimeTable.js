import { useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { fromSnakeCase } from '../lib/dbMappers'

/**
 * Subscribe to Supabase Realtime postgres_changes for a table.
 * When enabled, INSERT/UPDATE/DELETE from any client (or same tab) update local state so the UI stays in sync without refresh.
 *
 * @param {string} tableName - Table name (e.g. 'invoices', 'credit_notes')
 * @param {function} setRows - State setter for the rows array (e.g. setInvoices)
 * @param {boolean} enabled - Whether to subscribe (e.g. when Supabase is configured and page is active)
 */
export function useRealtimeTable(tableName, setRows, enabled = true) {
  const setRowsRef = useRef(setRows)
  setRowsRef.current = setRows

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured() || !tableName) return

    const channel = supabase
      .channel(`realtime:${tableName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        (payload) => {
          const setRows = setRowsRef.current
          if (!setRows) return

          const event = payload.eventType ?? payload.event_type
          const id = payload.new?.id ?? payload.old?.id
          if ((event === 'INSERT') && payload.new) {
            setRows((prev) => {
              const mapped = fromSnakeCase(payload.new)
              if (prev.some((r) => r.id === mapped.id)) return prev
              return [...prev, mapped]
            })
          } else if ((event === 'UPDATE') && payload.new) {
            setRows((prev) =>
              prev.map((r) => (r.id === id ? fromSnakeCase(payload.new) : r))
            )
          } else if ((event === 'DELETE') && id) {
            setRows((prev) => prev.filter((r) => r.id !== id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableName, enabled])
}
