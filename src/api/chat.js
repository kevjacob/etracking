/**
 * Chat messages. All logged-in users can read and send (insert via RPC).
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { fromSnakeCase } from '../lib/dbMappers'

const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5MB

export function isAllowedAttachmentType(type) {
  if (!type) return false
  const t = type.toLowerCase().trim()
  return ALLOWED_ATTACHMENT_TYPES.some((a) => t === a || (a === 'image/jpeg' && t === 'image/jpg'))
}

export function isAllowedAttachmentFile(file) {
  const t = (file.type || '').toLowerCase()
  if (!ALLOWED_ATTACHMENT_TYPES.some((allowed) => t === allowed || (allowed === 'image/jpg' && t === 'image/jpeg'))) return false
  return file.size <= MAX_ATTACHMENT_BYTES
}

export async function fetchChatMessages() {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, user_id, username, name, content, attachment_filename, attachment_content_type, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(fromSnakeCase)
}

export async function sendChatMessage(username, content, attachment = null) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const payload = {
    p_username: username,
    p_content: content ?? '',
    p_attachment_base64: null,
    p_attachment_filename: null,
    p_attachment_content_type: null,
  }
  if (attachment && attachment.base64 && attachment.filename && attachment.contentType) {
    payload.p_attachment_base64 = attachment.base64
    payload.p_attachment_filename = attachment.filename
    payload.p_attachment_content_type = attachment.contentType
  }
  const { data, error } = await supabase.rpc('insert_chat_message', payload)
  if (error) throw error
  return data
}

export async function getChatAttachment(messageId) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('get_chat_attachment', { p_message_id: messageId })
  if (error) throw error
  return data
}
