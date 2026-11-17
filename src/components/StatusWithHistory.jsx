import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchStatusHistoryForEntity } from '../api/statusHistory'

const OPEN_EVENT = 'etracking-status-history-open'
let openToken = 0

function formatHistoryWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dateOpts = { month: 'long', day: 'numeric' }
  if (d.getFullYear() !== new Date().getFullYear()) dateOpts.year = 'numeric'
  const date = d.toLocaleDateString('en-US', dateOpts)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}, ${time}`
}

function editorInitial(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed || trimmed === 'Unknown') return '?'
  return trimmed.charAt(0).toUpperCase()
}

function isFirstStatus(entry) {
  const from = String(entry?.fromStatus || '').trim()
  return !from || from === '(New)'
}

function placeOnScreen(x, y, width, height) {
  const pad = 8
  let left = x
  let top = y
  if (left + width > window.innerWidth - pad) left = window.innerWidth - width - pad
  if (top + height > window.innerHeight - pad) top = window.innerHeight - height - pad
  return { left: Math.max(pad, left), top: Math.max(pad, top) }
}

function Anchored({ x, y, measureKey, className, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(() => ({ left: x, top: y }))

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos(placeOnScreen(x, y, rect.width, rect.height))
  }, [x, y, measureKey])

  return (
    <div ref={ref} style={{ left: pos.left, top: pos.top }} className={`fixed z-[90] ${className || ''}`}>
      {children}
    </div>
  )
}

function HistoryChangeText({ entry }) {
  const to = String(entry.toStatus || '').trim() || '—'
  if (isFirstStatus(entry)) {
    return (
      <p className="mt-4 text-[14px] leading-snug text-[#3c4043]">
        Set status to <span className="font-semibold text-[#202124]">&quot;{to}&quot;</span>
      </p>
    )
  }
  const from = String(entry.fromStatus || '').trim() || '—'
  return (
    <p className="mt-4 text-[14px] leading-snug text-[#3c4043]">
      Replaced: <span className="font-semibold text-[#202124]">&quot;{from}&quot;</span>
      <br />
      with <span className="font-semibold text-[#202124]">&quot;{to}&quot;</span>
    </p>
  )
}

function HistoryCard({ entityType, entityId, x, y, onClose }) {
  const cardRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchStatusHistoryForEntity(entityType, entityId)
      .then((rows) => {
        if (cancelled) return
        const list = Array.isArray(rows) ? rows : []
        setEntries(list)
        setIndex(Math.max(0, list.length - 1))
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message || 'Could not load update history.')
        setEntries([])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entityType, entityId])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => Math.min(entries.length - 1, i + 1))
      }
    }
    const onPointer = (e) => {
      if (cardRef.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [entries.length, onClose])

  const entry = entries[index]
  const name = String(entry?.editedBy || '').trim() || 'Unknown'
  const atStart = index <= 0
  const atEnd = entries.length === 0 || index >= entries.length - 1

  return (
    <Anchored x={x} y={y} measureKey={`${loading}-${error}-${index}-${entries.length}`}>
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Edit history"
        className="w-[320px] rounded-lg border border-[#dadce0] bg-white px-4 pb-4 pt-3 shadow-[0_4px_8px_rgba(60,64,67,0.15),0_1px_3px_rgba(60,64,67,0.3)]"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium text-[#188038]">Edit history</h3>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={loading || atStart}
              className="rounded p-0.5 text-[#188038] hover:bg-[#e6f4ea] disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Older update"
              title="Older update"
            >
              <ChevronLeft size={20} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(entries.length - 1, i + 1))}
              disabled={loading || atEnd}
              className="rounded p-0.5 text-[#188038] hover:bg-[#e6f4ea] disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Newer update"
              title="Newer update"
            >
              <ChevronRight size={20} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {loading && <p className="mt-4 text-sm text-[#5f6368]">Loading history…</p>}
        {!loading && error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="mt-4 text-sm text-[#5f6368]">No status updates yet.</p>
        )}
        {!loading && !error && entry && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e91e63] text-sm font-semibold text-white">
                {editorInitial(name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#202124]">{name}</p>
                <p className="text-[13px] text-[#5f6368]">{formatHistoryWhen(entry.toStatusAt)}</p>
              </div>
            </div>
            <HistoryChangeText entry={entry} />
          </>
        )}
      </div>
    </Anchored>
  )
}

function ContextMenu({ x, y, onView, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const onPointer = (e) => {
      if (menuRef.current?.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <Anchored x={x} y={y} measureKey="menu">
      <div
        ref={menuRef}
        className="min-w-[196px] overflow-hidden rounded-md border border-[#dadce0] bg-white py-1 shadow-[0_4px_8px_rgba(60,64,67,0.15),0_1px_3px_rgba(60,64,67,0.3)]"
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          onClick={onView}
          className="w-full px-3 py-2 text-left text-sm text-[#202124] hover:bg-[#f1f3f4]"
        >
          View Update History
        </button>
      </div>
    </Anchored>
  )
}

/**
 * Right-click a status control to open its update history.
 * History opens on the newest change. Left steps to older updates, back to the first.
 */
export default function StatusWithHistory({ entityType, entityId, children }) {
  const tokenRef = useRef(0)
  const [menu, setMenu] = useState(null)
  const [card, setCard] = useState(null)

  useEffect(() => {
    const onOpen = (e) => {
      if (e.detail !== tokenRef.current) {
        setMenu(null)
        setCard(null)
      }
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const openMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    tokenRef.current = ++openToken
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tokenRef.current }))
    setCard(null)
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const openHistory = () => {
    if (!menu) return
    const anchor = menu
    setMenu(null)
    setCard(anchor)
  }

  return (
    <div onContextMenu={openMenu}>
      {children}
      {menu &&
        createPortal(
          <ContextMenu x={menu.x} y={menu.y} onView={openHistory} onClose={() => setMenu(null)} />,
          document.body
        )}
      {card &&
        createPortal(
          <HistoryCard
            entityType={entityType}
            entityId={entityId}
            x={card.x}
            y={card.y}
            onClose={() => setCard(null)}
          />,
          document.body
        )}
    </div>
  )
}
