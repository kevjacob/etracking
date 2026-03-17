import { useState, useEffect, useRef, useMemo } from 'react'
import { MessageCircle, X, Send, Paperclip, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchChatMessages,
  sendChatMessage,
  getChatAttachment,
  isAllowedAttachmentFile,
} from '../api/chat'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { supabase, isSupabaseConfigured } from '../supabaseClient'

const PRESENCE_CHANNEL = 'etracking:presence'

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const am = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${am}`
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const dataUrl = r.result
      const base64 = dataUrl.indexOf('base64,') >= 0 ? dataUrl.split('base64,')[1] : dataUrl
      resolve(base64)
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function ChatBox() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [onlineUsers, setOnlineUsers] = useState([])
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const presenceChannelRef = useRef(null)
  const fileInputRef = useRef(null)
  const listEndRef = useRef(null)
  const lastSeenIdRef = useRef(null)
  const previousOpenRef = useRef(false)

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0)
      ),
    [messages]
  )

  const onlineCount = useMemo(() => {
    const byId = new Map()
    ;(onlineUsers || []).forEach((u) => byId.set(u.userId || u.username, u))
    return byId.size
  }, [onlineUsers])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.username) return
    setLoading(true)
    fetchChatMessages()
      .then((list) => setMessages(Array.isArray(list) ? list : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [user?.username])

  useRealtimeTable('chat_messages', setMessages, !!user?.username && isSupabaseConfigured())

  useEffect(() => {
    if (open && listEndRef.current) listEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [open, sortedMessages.length])

  useEffect(() => {
    if (open) {
      setHasUnread(false)
      if (sortedMessages.length > 0) {
        const latest = sortedMessages[sortedMessages.length - 1]
        lastSeenIdRef.current = latest?.id ?? null
      }
    } else if (previousOpenRef.current) {
      if (sortedMessages.length > 0) {
        const latest = sortedMessages[sortedMessages.length - 1]
        lastSeenIdRef.current = latest?.id ?? null
      }
    }
    previousOpenRef.current = open
  }, [open, sortedMessages])

  useEffect(() => {
    if (open) return
    if (sortedMessages.length === 0) return
    const latest = sortedMessages[sortedMessages.length - 1]
    if (!latest || latest.username === user?.username) return
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = latest.id
      return
    }
    if (latest.id !== lastSeenIdRef.current) setHasUnread(true)
  }, [open, sortedMessages, user?.username])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.username || !user?.id) return
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const list = []
        Object.values(state).forEach((presences) => {
          (presences || []).forEach((p) => {
            list.push({
              userId: p.userId,
              username: p.username,
              name: p.name || p.username,
            })
          })
        })
        setOnlineUsers(list)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            username: user.username,
            name: user.name || user.username,
          })
        }
      })
    presenceChannelRef.current = channel
    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
      presenceChannelRef.current = null
    }
  }, [user?.id, user?.username, user?.name])

  const handleSend = async () => {
    const text = (inputValue || '').trim()
    if ((!text && !pendingFile) || !user?.username || sending) return
    setSendError('')
    setSending(true)
    try {
      let attachment = null
      if (pendingFile) {
        if (!isAllowedAttachmentFile(pendingFile)) {
          setSendError('File type not allowed or too large (max 5MB). Use PDF or image.')
          setSending(false)
          return
        }
        const base64 = await fileToBase64(pendingFile)
        attachment = {
          base64,
          filename: pendingFile.name,
          contentType: pendingFile.type || 'application/octet-stream',
        }
      }
      await sendChatMessage(user.username, text || '', attachment)
      setInputValue('')
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      console.error('Send chat error:', e)
      setSendError(e?.message || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  const handleAttachmentClick = async (msg) => {
    const fn = msg.attachmentFilename || msg.attachment_filename
    const type = msg.attachmentContentType || msg.attachment_content_type
    if (!fn) return
    try {
      const data = await getChatAttachment(msg.id)
      const b64 = data?.content_base64
      if (!b64) return
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      const blob = new Blob([arr], { type: type || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      if (type && type.startsWith('image/')) {
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = fn
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Download attachment error:', e)
    }
  }

  const uniqueOnlineList = useMemo(() => {
    const byId = new Map()
    ;(onlineUsers || []).forEach((u) => {
      const id = u.userId || u.username
      if (!byId.has(id)) byId.set(id, u)
    })
    return Array.from(byId.values())
  }, [onlineUsers])

  if (!user?.username || !isSupabaseConfigured()) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          hasUnread
            ? 'chat-btn-unread focus:ring-orange-500'
            : 'bg-blue-900 hover:bg-blue-800 focus:ring-blue-900'
        }`}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h3 className="font-semibold text-slate-800 shrink-0">Chat</h3>
              <div className="relative flex items-center gap-1">
                <span className="text-xs text-slate-500 shrink-0">
                  ({onlineCount} online)
                </span>
                <button
                  type="button"
                  onClick={() => setShowOnlineDropdown((v) => !v)}
                  className="rounded p-0.5 hover:bg-slate-200 text-slate-600"
                  aria-label="Show online users"
                >
                  <ChevronDown size={14} className={showOnlineDropdown ? 'rotate-180' : ''} />
                </button>
                {showOnlineDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-0"
                      aria-hidden
                      onClick={() => setShowOnlineDropdown(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 z-10 min-w-[160px] rounded border border-slate-200 bg-white py-2 shadow-lg">
                      <p className="px-3 py-1 text-xs font-medium text-slate-500">Online now</p>
                      {uniqueOnlineList.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">No one else online</p>
                      ) : (
                        uniqueOnlineList.map((u) => (
                          <div
                            key={u.userId || u.username}
                            className="px-3 py-1.5 text-sm text-slate-700"
                          >
                            {u.name || u.username}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex min-h-[280px] max-h-[400px] flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex flex-1 items-center justify-center p-4 text-slate-500 text-sm">
                Loading…
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto p-3 space-y-2">
                {sortedMessages.length === 0 ? (
                  <li className="py-4 text-center text-sm text-slate-500">
                    No messages yet. Say hi!
                  </li>
                ) : (
                  sortedMessages.map((msg) => {
                    const isOwn = msg.username === user.username
                    const ts = msg.createdAt || msg.created_at
                    const attName =
                      msg.attachmentFilename || msg.attachment_filename
                    return (
                      <li
                        key={msg.id}
                        className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            isOwn
                              ? 'bg-blue-900 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {!isOwn && (
                            <span className="mb-0.5 block text-xs font-medium opacity-90">
                              {msg.name || msg.username}
                            </span>
                          )}
                          {msg.content ? (
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {msg.content}
                            </p>
                          ) : null}
                          {attName && (
                            <button
                              type="button"
                              onClick={() => handleAttachmentClick(msg)}
                              className={`mt-1 flex items-center gap-1 text-xs underline ${
                                isOwn ? 'text-blue-200' : 'text-slate-600'
                              }`}
                            >
                              <Paperclip size={12} />
                              {attName}
                            </button>
                          )}
                          <span
                            className={`mt-1 block text-xs ${
                              isOwn ? 'text-blue-200' : 'text-slate-500'
                            }`}
                          >
                            {ts ? formatTime(ts) : ''}
                          </span>
                        </div>
                      </li>
                    )
                  })
                )}
                <li ref={listEndRef} />
              </ul>
            )}

            {sendError && (
              <p
                className="border-t border-slate-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                role="alert"
              >
                {sendError}
              </p>
            )}
            <div className="flex flex-col gap-2 border-t border-slate-200 p-2">
              {pendingFile && (
                <div className="flex items-center justify-between rounded bg-slate-100 px-2 py-1.5 text-xs text-slate-700">
                  <span className="truncate">{pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="shrink-0 text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setPendingFile(f)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                  aria-label="Attach file"
                  title="PDF or image (max 5MB)"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && !e.shiftKey && handleSend()
                  }
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-900 disabled:opacity-60"
                  disabled={sending}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    sending || (!inputValue.trim() && !pendingFile)
                  }
                  className="shrink-0 rounded bg-blue-900 px-3 py-2 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
                >
                  <Send size={18} />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
