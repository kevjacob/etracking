/**
 * Announcements API. List uses direct table select (avoids RPC schema cache).
 * Create/update/delete use RPCs (superuser-only).
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'

export async function fetchAnnouncements() {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function createAnnouncement(adminUsername, { title, body }) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('create_announcement', {
    p_username: adminUsername,
    p_title: title ?? '',
    p_body: body ?? '',
  })
  if (error) throw error
  return data
}

export async function updateAnnouncement(adminUsername, id, { title, body }) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const { error } = await supabase.rpc('update_announcement', {
    p_username: adminUsername,
    p_id: id,
    p_title: title ?? '',
    p_body: body ?? '',
  })
  if (error) throw error
}

export async function deleteAnnouncement(adminUsername, id) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const { error } = await supabase.rpc('delete_announcement', {
    p_username: adminUsername,
    p_id: id,
  })
  if (error) throw error
}
