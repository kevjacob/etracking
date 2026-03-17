import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../api/announcements'
import { formatDate } from '../utils/dateFormat'

export default function AnnouncementPage() {
  const navigate = useNavigate()
  const { user, isSuperuser, authReady } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addBody, setAddBody] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const [editAnn, setEditAnn] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [deleteId, setDeleteId] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const loadAnnouncements = useCallback(async () => {
    if (!user?.username) return
    setLoading(true)
    setError('')
    try {
      const list = await fetchAnnouncements()
      setAnnouncements(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err.message || 'Failed to load announcements.')
    } finally {
      setLoading(false)
    }
  }, [user?.username])

  useEffect(() => {
    if (authReady && user && !isSuperuser) {
      navigate('/', { replace: true })
      return
    }
    if (isSuperuser && user?.username) loadAnnouncements()
  }, [authReady, user, isSuperuser, navigate, loadAnnouncements])

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    setAddError('')
    if (!addTitle.trim()) {
      setAddError('Title is required.')
      return
    }
    setAddSaving(true)
    try {
      await createAnnouncement(user.username, { title: addTitle.trim(), body: addBody.trim() })
      setAddTitle('')
      setAddBody('')
      setShowAddForm(false)
      await loadAnnouncements()
    } catch (err) {
      setAddError(err.message || 'Failed to create announcement.')
    } finally {
      setAddSaving(false)
    }
  }

  const openEdit = (ann) => {
    setEditAnn(ann)
    setEditTitle(ann.title ?? '')
    setEditBody(ann.body ?? '')
    setEditError('')
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editAnn) return
    setEditError('')
    if (!editTitle.trim()) {
      setEditError('Title is required.')
      return
    }
    setEditSaving(true)
    try {
      await updateAnnouncement(user.username, editAnn.id, { title: editTitle.trim(), body: editBody.trim() })
      setEditAnn(null)
      await loadAnnouncements()
    } catch (err) {
      setEditError(err.message || 'Failed to update announcement.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteSaving(true)
    try {
      await deleteAnnouncement(user.username, deleteId)
      setDeleteId(null)
      await loadAnnouncements()
    } catch (err) {
      setEditError(err.message || 'Failed to delete announcement.')
    } finally {
      setDeleteSaving(false)
    }
  }

  if (!isSuperuser) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-end mb-6">
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium shadow"
        >
          <Plus size={18} />
          {showAddForm ? 'Cancel' : 'Add Announcement'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">New announcement</h2>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                placeholder="Announcement title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content (optional)</label>
              <textarea
                value={addBody}
                onChange={(e) => setAddBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                placeholder="Announcement content"
              />
            </div>
            {addError && <p className="text-sm text-red-600" role="alert">{addError}</p>}
            <button
              type="submit"
              disabled={addSaving}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
            >
              {addSaving ? 'Saving…' : 'Save announcement'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Announcements</h2>
          <p className="text-sm text-slate-500 mt-1">Manage announcements (superuser only).</p>
        </div>
        {error && <p className="text-sm text-red-600 px-4 py-2" role="alert">{error}</p>}
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-b-lg bg-slate-50/50">
            No announcements yet. Click &quot;Add Announcement&quot; to create one.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {announcements.map((ann) => (
              <li key={ann.id} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{ann.title}</p>
                  {ann.body && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{ann.body}</p>}
                  <p className="text-xs text-slate-400 mt-2">
                    {ann.created_at ? formatDate(ann.created_at) : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(ann)}
                    className="p-1.5 rounded text-slate-600 hover:bg-slate-200"
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(ann.id)}
                    className="p-1.5 rounded text-red-600 hover:bg-red-50"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800">Edit announcement</h3>
              <button
                type="button"
                onClick={() => setEditAnn(null)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content (optional)</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>
              {editError && <p className="text-sm text-red-600" role="alert">{editError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditAnn(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Delete announcement?</h3>
            <p className="text-sm text-slate-600 mb-4">This cannot be undone.</p>
            {editError && <p className="text-sm text-red-600 mb-2" role="alert">{editError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {deleteSaving ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteId(null); setEditError('') }}
                disabled={deleteSaving}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
