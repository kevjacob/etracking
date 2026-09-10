import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { fetchKegOutlets, insertKegOutlet } from '../api/kegOutlets'
import { fetchKegMovements, insertKegMovement, updateKegMovement, deleteKegMovement } from '../api/kegMovements'
import { fetchKegStockEntries, insertKegStockEntry, deleteKegStockEntry } from '../api/kegStockEntries'
import { useWarehouses } from '../context/WarehousesContext'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatDate } from '../utils/dateFormat'
import { filterOwnWarehouses } from '../utils/warehouseUtils'
import {
  HMB_RETURN_TO,
  KEG_BRANDS,
  KEG_SKUS,
  KEG_DOC_PREFIX,
  KEG_UNIT,
  TENUN_WAREHOUSE_NAME,
  brandSku,
  computeBrandTotals,
  computeOutletDispatchSummary,
  formatItemsLabel,
  formatKegDocNo,
  formatKegQty,
  getTodayDateStr,
  movementLabel,
  parseKegDocDigits,
  skuLabel,
} from '../utils/kegTracking'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isSupabaseId(id) {
  return typeof id === 'string' && UUID_REGEX.test(id)
}

const STAT_CARDS = [
  { key: 'all', label: 'ALL KEGS', bar: 'bg-blue-500', add: null },
  { key: 'available', label: 'AVAILABLE KEGS', bar: 'bg-green-500', add: 'receive' },
  { key: 'dispatched', label: 'KEGS DISPATCHED', bar: 'bg-orange-400', add: null },
  { key: 'empty', label: 'EMPTY KEGS', bar: 'bg-red-500', add: 'return_hmb' },
]

function emptyDispatchForm() {
  return {
    docDigits: '',
    entryDate: getTodayDateStr(),
    warehouseId: '',
    outletId: '',
    outletName: '',
    outletQuery: '',
    items: [],
    remark: '',
  }
}

function emptyStockForm(brand, entryType) {
  return {
    brand,
    entryType,
    entryDate: getTodayDateStr(),
    docNo: '',
    referenceNo: '',
    sku: brandSku(brand),
    quantity: '',
  }
}

function StatCard({ card, value, onAdd, onOpen, viewLabel }) {
  const clickable = Boolean(onOpen)
  return (
    <div className="group bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        type="button"
        disabled={!clickable}
        onClick={onOpen}
        className={`w-full px-4 pt-5 pb-3 text-center ${clickable ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
      >
        <div className="text-3xl font-bold text-slate-800 tabular-nums">
          {value}
          <span className="ml-1.5 text-sm font-medium text-slate-500">{KEG_UNIT}</span>
        </div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-500 mt-2 uppercase">{card.label}</div>
      </button>
      {onAdd ? (
        <div className="flex justify-center pb-3 h-9">
          <button
            type="button"
            onClick={onAdd}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-900"
            aria-label={`Add ${card.label}`}
          >
            <Plus size={18} />
          </button>
        </div>
      ) : viewLabel ? (
        <div className="flex justify-center pb-3 h-9">
          <button
            type="button"
            onClick={onOpen}
            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 text-[11px] font-medium text-blue-900 hover:underline"
          >
            {viewLabel}
          </button>
        </div>
      ) : (
        <div className="h-9" />
      )}
      <div className={`h-1.5 ${card.bar}`} />
    </div>
  )
}

export default function KegTrackingPage() {
  const { warehouses } = useWarehouses()
  const ownWarehouses = useMemo(() => filterOwnWarehouses(warehouses), [warehouses])

  const [movements, setMovements] = useState([])
  const [stockEntries, setStockEntries] = useState([])
  const [outlets, setOutlets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState(null)
  const [form, setForm] = useState(() => emptyDispatchForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [skuDraft, setSkuDraft] = useState({ sku: 'guinness_20l', quantity: '' })
  const [skuPickerOpen, setSkuPickerOpen] = useState(false)

  const [addOutletOpen, setAddOutletOpen] = useState(false)
  const [pendingOutletName, setPendingOutletName] = useState('')

  const [stockModal, setStockModal] = useState(null)
  const [stockForm, setStockForm] = useState(null)
  const [stockError, setStockError] = useState('')
  const [stockSaving, setStockSaving] = useState(false)

  const [historyModal, setHistoryModal] = useState(null)
  const [outletSummaryOpen, setOutletSummaryOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [movementRows, stockRows, outletRows] = await Promise.all([
        fetchKegMovements(),
        fetchKegStockEntries(),
        fetchKegOutlets(),
      ])
      setMovements(Array.isArray(movementRows) ? movementRows : [])
      setStockEntries(Array.isArray(stockRows) ? stockRows : [])
      setOutlets(Array.isArray(outletRows) ? outletRows : [])
    } catch (e) {
      console.error('Load keg tracking error:', e)
      setError(e.message || 'Could not load keg tracking.')
      setMovements([])
      setStockEntries([])
      setOutlets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useRealtimeTable('keg_movements', setMovements)
  useRealtimeTable('keg_stock_entries', setStockEntries)
  useRealtimeTable('keg_outlets', setOutlets)

  const totalsByBrand = useMemo(() => {
    const map = {}
    for (const brand of KEG_BRANDS) {
      map[brand.key] = computeBrandTotals(brand.key, movements, stockEntries)
    }
    return map
  }, [movements, stockEntries])

  const outletDispatchSummary = useMemo(() => computeOutletDispatchSummary(movements), [movements])
  const outletDispatchTotals = useMemo(() => {
    const bySku = Object.fromEntries(KEG_SKUS.map((sku) => [sku.value, 0]))
    let total = 0
    for (const row of outletDispatchSummary) {
      total += Number(row.total) || 0
      for (const sku of KEG_SKUS) {
        bySku[sku.value] += Number(row.bySku[sku.value]) || 0
      }
    }
    return { bySku, total }
  }, [outletDispatchSummary])

  const sortedMovements = useMemo(
    () =>
      [...movements].sort((a, b) => {
        const da = String(a.entryDate || '')
        const db = String(b.entryDate || '')
        if (da !== db) return db.localeCompare(da)
        return String(b.docNo || '').localeCompare(String(a.docNo || ''))
      }),
    [movements]
  )

  const outletMatches = useMemo(() => {
    const q = form.outletQuery.trim().toLowerCase()
    if (!q) return outlets.slice(0, 8)
    return outlets.filter((o) => String(o.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [outlets, form.outletQuery])

  const showAddOutlet = useMemo(() => {
    const q = form.outletQuery.trim()
    if (!q) return false
    return !outlets.some((o) => String(o.name || '').trim().toLowerCase() === q.toLowerCase())
  }, [outlets, form.outletQuery])

  const openDispatch = (row = null) => {
    setEditingMovement(row)
    setFormError('')
    setSkuPickerOpen(false)
    if (row) {
      setForm({
        docDigits: parseKegDocDigits(row.docNo),
        entryDate: row.entryDate || getTodayDateStr(),
        warehouseId: row.warehouseId || '',
        outletId: row.outletId || '',
        outletName: row.outletName || '',
        outletQuery: row.outletName || '',
        items: Array.isArray(row.items) ? row.items : [],
        remark: row.remark || '',
      })
    } else {
      setForm(emptyDispatchForm())
    }
    setDispatchOpen(true)
    setReturnOpen(false)
  }

  const openReturn = (row = null) => {
    setEditingMovement(row)
    setFormError('')
    setSkuPickerOpen(false)
    if (row) {
      setForm({
        docDigits: parseKegDocDigits(row.docNo),
        entryDate: row.entryDate || getTodayDateStr(),
        warehouseId: row.warehouseId || '',
        outletId: row.outletId || '',
        outletName: row.outletName || '',
        outletQuery: row.outletName || '',
        items: Array.isArray(row.items) ? row.items : [],
        remark: row.remark || '',
      })
    } else {
      setForm(emptyDispatchForm())
    }
    setReturnOpen(true)
    setDispatchOpen(false)
  }

  const closeMovementModal = () => {
    setDispatchOpen(false)
    setReturnOpen(false)
    setEditingMovement(null)
    setFormError('')
    setSkuPickerOpen(false)
    setAddOutletOpen(false)
  }

  const selectOutlet = (outlet) => {
    setForm((prev) => ({
      ...prev,
      outletId: outlet.id,
      outletName: outlet.name,
      outletQuery: outlet.name,
    }))
  }

  const confirmAddOutlet = async () => {
    const name = pendingOutletName.trim()
    if (!name) return
    try {
      const created = await insertKegOutlet(name)
      setOutlets((prev) => {
        if (prev.some((o) => o.id === created.id)) return prev
        return [...prev, created].sort((a, b) => String(a.name).localeCompare(String(b.name)))
      })
      selectOutlet(created)
    } catch (e) {
      setFormError(e.message || 'Could not add outlet.')
    }
    setAddOutletOpen(false)
    setPendingOutletName('')
  }

  const addSkuLine = () => {
    const qty = Number(skuDraft.quantity)
    if (!skuDraft.sku || !Number.isFinite(qty) || qty <= 0) return
    setForm((prev) => {
      const existing = prev.items.find((item) => item.sku === skuDraft.sku)
      const items = existing
        ? prev.items.map((item) =>
            item.sku === skuDraft.sku ? { ...item, quantity: Number(item.quantity) + qty } : item
          )
        : [...prev.items, { sku: skuDraft.sku, quantity: qty }]
      return { ...prev, items }
    })
    setSkuDraft({ sku: 'guinness_20l', quantity: '' })
    setSkuPickerOpen(false)
  }

  const resolveOutlet = () => {
    if (form.outletId) {
      return outlets.find((o) => o.id === form.outletId) || { id: form.outletId, name: form.outletName }
    }
    const q = form.outletQuery.trim().toLowerCase()
    if (!q) return null
    return outlets.find((o) => String(o.name || '').trim().toLowerCase() === q) || null
  }

  const validateMovement = (type) => {
    if (!formatKegDocNo(form.docDigits)) return 'Doc No is required.'
    if (!form.entryDate) return 'Date is required.'
    if (!form.warehouseId) return 'Warehouse is required.'
    if (!resolveOutlet() && !form.outletName) return 'Outlet is required. Search and select one, or add it with +.'
    if (!form.items.length) return 'Add at least one product SKU.'
    const warehouse = ownWarehouses.find((w) => w.id === form.warehouseId)
    if (!warehouse) return 'Select an own warehouse.'

    for (const brand of KEG_BRANDS) {
      const sku = brandSku(brand.key)
      const qty = form.items.filter((i) => i.sku === sku).reduce((s, i) => s + Number(i.quantity || 0), 0)
      if (qty <= 0) continue
      const totals = computeBrandTotals(brand.key, movements, stockEntries, editingMovement?.id)
      if (type === 'dispatch' && qty > totals.available) {
        return `${brand.label}: only ${formatKegQty(totals.available)} available.`
      }
      if (type === 'return' && qty > totals.dispatched) {
        return `${brand.label}: only ${formatKegQty(totals.dispatched)} dispatched can be returned.`
      }
    }
    return ''
  }

  const saveMovement = async (type) => {
    const err = validateMovement(type)
    if (err) {
      setFormError(err)
      return
    }
    const warehouse = ownWarehouses.find((w) => w.id === form.warehouseId)
    const outlet = resolveOutlet()
    const payload = {
      docNo: formatKegDocNo(form.docDigits),
      entryDate: form.entryDate,
      movementType: type,
      warehouseId: isSupabaseId(warehouse.id) ? warehouse.id : null,
      warehouseName: warehouse.name,
      outletId: isSupabaseId(outlet?.id) ? outlet.id : null,
      outletName: outlet?.name || form.outletName || form.outletQuery.trim(),
      remark: form.remark.trim(),
      items: form.items,
    }
    setSaving(true)
    try {
      if (editingMovement) {
        const updated = await updateKegMovement(editingMovement.id, payload)
        setMovements((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      } else {
        const inserted = await insertKegMovement(payload)
        setMovements((prev) => [...prev, inserted])
      }
      closeMovementModal()
    } catch (e) {
      setFormError(e.message || 'Could not save entry.')
    } finally {
      setSaving(false)
    }
  }

  const openStockAdd = (brand, entryType) => {
    setStockModal({ brand, entryType })
    setStockForm(emptyStockForm(brand, entryType))
    setStockError('')
  }

  const saveStock = async () => {
    const qty = Number(stockForm.quantity)
    if (!stockForm.entryDate) {
      setStockError('Date is required.')
      return
    }
    if (!String(stockForm.docNo || '').trim()) {
      setStockError('Doc No is required.')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setStockError('Unit must be greater than 0.')
      return
    }
    if (stockForm.entryType === 'return_hmb') {
      const totals = computeBrandTotals(stockForm.brand, movements, stockEntries)
      if (qty > totals.empty) {
        setStockError(`Only ${formatKegQty(totals.empty)} empty can be returned.`)
        return
      }
    }
    setStockSaving(true)
    try {
      const inserted = await insertKegStockEntry({
        brand: stockForm.brand,
        entryType: stockForm.entryType,
        entryDate: stockForm.entryDate,
        docNo: String(stockForm.docNo).trim(),
        warehouseName: TENUN_WAREHOUSE_NAME,
        returnTo: stockForm.entryType === 'return_hmb' ? HMB_RETURN_TO : '',
        referenceNo: String(stockForm.referenceNo || '').trim(),
        sku: stockForm.sku,
        quantity: qty,
      })
      setStockEntries((prev) => [...prev, inserted])
      setStockModal(null)
      setStockForm(null)
    } catch (e) {
      setStockError(e.message || 'Could not save stock entry.')
    } finally {
      setStockSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.kind === 'movement') {
        await deleteKegMovement(deleteTarget.id)
        setMovements((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      } else {
        await deleteKegStockEntry(deleteTarget.id)
        setStockEntries((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      }
    } catch (e) {
      setError(e.message || 'Could not delete.')
    }
    setDeleteTarget(null)
  }

  const historyEntries = useMemo(() => {
    if (!historyModal) return []
    return stockEntries
      .filter((e) => {
        const brand = e.brand === 'heineken' ? 'guinness' : e.brand
        return brand === historyModal.brand && e.entryType === historyModal.entryType
      })
      .slice()
      .sort((a, b) => String(b.entryDate || '').localeCompare(String(a.entryDate || '')))
  }, [historyModal, stockEntries])

  const movementModalOpen = dispatchOpen || returnOpen
  const movementType = dispatchOpen ? 'dispatch' : 'return'

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {KEG_BRANDS.map((brand) => {
        const totals = totalsByBrand[brand.key]
        return (
          <section key={brand.key}>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">{brand.label}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {STAT_CARDS.map((card) => (
                <StatCard
                  key={card.key}
                  card={card}
                  value={totals[card.key] ?? 0}
                  onAdd={
                    card.add
                      ? () => openStockAdd(brand.key, card.add)
                      : undefined
                  }
                  viewLabel={card.key === 'dispatched' ? 'View Outlet Dispatch' : undefined}
                  onOpen={
                    card.key === 'dispatched'
                      ? () => setOutletSummaryOpen(true)
                      : card.add
                        ? () => setHistoryModal({ brand: brand.key, entryType: card.add, label: card.label })
                        : undefined
                  }
                />
              ))}
            </div>
          </section>
        )
      })}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-slate-800">Entries</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openDispatch()}
              className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
            >
              Dispatch
            </button>
            <button
              type="button"
              onClick={() => openReturn()}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm font-medium"
            >
              Return
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading keg entries…</div>
          ) : sortedMovements.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No entries yet. Use Dispatch or Return to add one.</div>
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Doc. No</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Movement</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">SKU</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Additional Remark</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedMovements.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-800">{row.docNo}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.entryDate ? formatDate(row.entryDate) : '–'}</td>
                    <td className="py-2.5 px-4 text-slate-700">{movementLabel(row)}</td>
                    <td className="py-2.5 px-4 text-slate-700">{formatItemsLabel(row.items)}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.remark || '–'}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => (row.movementType === 'return' ? openReturn(row) : openDispatch(row))}
                          className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-900"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ kind: 'movement', id: row.id, label: row.docNo })}
                          className="p-1.5 rounded text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {movementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingMovement ? 'Edit' : movementType === 'dispatch' ? 'Dispatch' : 'Return'}
              </h3>
              <button type="button" onClick={closeMovementModal} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Doc No.</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600 shrink-0">{KEG_DOC_PREFIX}</span>
                  <input
                    type="text"
                    value={form.docDigits}
                    onChange={(e) => setForm((prev) => ({ ...prev, docDigits: e.target.value }))}
                    placeholder="Doc number"
                    className="flex-1 py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.entryDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, entryDate: e.target.value }))}
                  className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse</label>
                <select
                  value={form.warehouseId}
                  onChange={(e) => setForm((prev) => ({ ...prev, warehouseId: e.target.value }))}
                  className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                >
                  <option value="">Select warehouse</option>
                  {ownWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Outlet</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.outletQuery}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        outletQuery: e.target.value,
                        outletId: '',
                        outletName: '',
                      }))
                    }
                    placeholder="Search outlet"
                    className="flex-1 py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                  />
                  {showAddOutlet && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingOutletName(form.outletQuery.trim())
                        setAddOutletOpen(true)
                      }}
                      className="p-2 rounded-lg bg-blue-900 text-white hover:bg-blue-800"
                      aria-label="Add outlet"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
                {outletMatches.length > 0 && (
                  <ul className="mt-1 max-h-36 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
                    {outletMatches.map((outlet) => (
                      <li key={outlet.id}>
                        <button
                          type="button"
                          onClick={() => selectOutlet(outlet)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                            form.outletId === outlet.id ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700'
                          }`}
                        >
                          {outlet.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {form.outletName && (
                  <p className="mt-1 text-xs text-blue-900">Selected: {form.outletName}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Product SKU</label>
                  <button
                    type="button"
                    onClick={() => setSkuPickerOpen(true)}
                    className="inline-flex items-center gap-1 text-sm text-blue-900 hover:underline"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                {form.items.length === 0 ? (
                  <p className="text-sm text-slate-400">No SKU added yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {form.items.map((item) => (
                      <li key={item.sku} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-200 rounded px-3 py-2">
                        <span>
                          {skuLabel(item.sku)} × {formatKegQty(item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, items: prev.items.filter((i) => i.sku !== item.sku) }))
                          }
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Remove SKU"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Additional Remark</label>
                <textarea
                  value={form.remark}
                  onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                  rows={3}
                  className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={closeMovementModal} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveMovement(movementType)}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {skuPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Add SKU</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product SKU</label>
                <select
                  value={skuDraft.sku}
                  onChange={(e) => setSkuDraft((prev) => ({ ...prev, sku: e.target.value }))}
                  className="w-full py-2 px-3 border border-slate-300 rounded"
                >
                  {KEG_SKUS.map((sku) => (
                    <option key={sku.value} value={sku.value}>
                      {sku.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={skuDraft.quantity}
                    onChange={(e) => setSkuDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="flex-1 py-2 px-3 border border-slate-300 rounded"
                  />
                  <span className="text-sm text-slate-500">{KEG_UNIT}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setSkuPickerOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg">
                Cancel
              </button>
              <button type="button" onClick={addSkuLine} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {addOutletOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Add outlet</h3>
            <p className="text-sm text-slate-600">
              Add <span className="font-medium text-slate-800">{pendingOutletName}</span> into the outlet list?
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setAddOutletOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg">
                No
              </button>
              <button type="button" onClick={confirmAddOutlet} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {stockModal && stockForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              {stockForm.entryType === 'receive' ? 'New keg entry' : 'Return empty kegs'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={stockForm.entryDate}
                  onChange={(e) => setStockForm((prev) => ({ ...prev, entryDate: e.target.value }))}
                  className="w-full py-2 px-3 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Doc No</label>
                <input
                  type="text"
                  value={stockForm.docNo}
                  onChange={(e) => setStockForm((prev) => ({ ...prev, docNo: e.target.value }))}
                  className="w-full py-2 px-3 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse</label>
                <input
                  type="text"
                  value={TENUN_WAREHOUSE_NAME}
                  readOnly
                  className="w-full py-2 px-3 border border-slate-200 rounded bg-slate-50"
                />
              </div>
              {stockForm.entryType === 'return_hmb' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Return to</label>
                  <input
                    type="text"
                    value={HMB_RETURN_TO}
                    readOnly
                    className="w-full py-2 px-3 border border-slate-200 rounded bg-slate-50"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference No</label>
                <input
                  type="text"
                  value={stockForm.referenceNo}
                  onChange={(e) => setStockForm((prev) => ({ ...prev, referenceNo: e.target.value }))}
                  className="w-full py-2 px-3 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product SKU</label>
                <input
                  type="text"
                  value={skuLabel(stockForm.sku)}
                  readOnly
                  className="w-full py-2 px-3 border border-slate-200 rounded bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={stockForm.quantity}
                    onChange={(e) => setStockForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="flex-1 py-2 px-3 border border-slate-300 rounded"
                  />
                  <span className="text-sm text-slate-500">{KEG_UNIT}</span>
                </div>
              </div>
            </div>
            {stockError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{stockError}</p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setStockModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg">
                Cancel
              </button>
              <button
                type="button"
                disabled={stockSaving}
                onClick={saveStock}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                {stockSaving ? 'Saving…' : stockForm.entryType === 'receive' ? 'Received' : 'Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {outletSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-800">Outlet Dispatch</h3>
              <button
                type="button"
                onClick={() => setOutletSummaryOpen(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              Guinness and Tiger kegs currently dispatched to each outlet, split by SKU.
            </p>
            <div className="overflow-auto border border-slate-200 rounded">
              {outletDispatchSummary.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 text-center">No kegs are currently dispatched to outlets.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left py-2 px-3">Outlet</th>
                      {KEG_SKUS.map((sku) => (
                        <th key={sku.value} className="text-left py-2 px-3">
                          {sku.label}
                        </th>
                      ))}
                      <th className="text-left py-2 px-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outletDispatchSummary.map((row) => (
                      <tr key={row.key} className="border-t border-slate-100">
                        <td className="py-2 px-3 font-medium text-slate-800">{row.outletName}</td>
                        {KEG_SKUS.map((sku) => (
                          <td key={sku.value} className="py-2 px-3 text-slate-700">
                            {formatKegQty(row.bySku[sku.value] || 0)}
                          </td>
                        ))}
                        <td className="py-2 px-3 font-medium text-slate-800">{formatKegQty(row.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                      <td className="py-2 px-3 text-slate-800">Total</td>
                      {KEG_SKUS.map((sku) => (
                        <td key={sku.value} className="py-2 px-3 text-slate-800">
                          {formatKegQty(outletDispatchTotals.bySku[sku.value] || 0)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-slate-800">{formatKegQty(outletDispatchTotals.total)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-800">
                {KEG_BRANDS.find((b) => b.key === historyModal.brand)?.label} · {historyModal.label}
              </h3>
              <button type="button" onClick={() => setHistoryModal(null)} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              {historyModal.entryType === 'receive'
                ? 'New kegs received at Tenun. These add to Available Kegs.'
                : 'Empty kegs returned from Tenun to HMB. These deduct from Empty Kegs.'}
            </p>
            <div className="overflow-auto border border-slate-200 rounded">
              {historyEntries.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 text-center">No stock entries yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left py-2 px-3">Date</th>
                      <th className="text-left py-2 px-3">Doc No</th>
                      <th className="text-left py-2 px-3">Warehouse</th>
                      {historyModal.entryType === 'return_hmb' && <th className="text-left py-2 px-3">Return to</th>}
                      <th className="text-left py-2 px-3">Ref No</th>
                      <th className="text-left py-2 px-3">SKU</th>
                      <th className="text-left py-2 px-3">Unit</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-100">
                        <td className="py-2 px-3">{entry.entryDate ? formatDate(entry.entryDate) : '–'}</td>
                        <td className="py-2 px-3">{entry.docNo}</td>
                        <td className="py-2 px-3">{entry.warehouseName || TENUN_WAREHOUSE_NAME}</td>
                        {historyModal.entryType === 'return_hmb' && (
                          <td className="py-2 px-3">{entry.returnTo || HMB_RETURN_TO}</td>
                        )}
                        <td className="py-2 px-3">{entry.referenceNo || '–'}</td>
                        <td className="py-2 px-3">{skuLabel(entry.sku)}</td>
                        <td className="py-2 px-3">{formatKegQty(entry.quantity)}</td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ kind: 'stock', id: entry.id, label: entry.docNo })}
                            className="p-1 rounded text-slate-400 hover:text-red-600"
                            aria-label="Delete stock entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Delete entry</h3>
            <p className="text-sm text-slate-600">
              Delete <span className="font-medium">{deleteTarget.label}</span>? This will update keg totals.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-slate-300 rounded-lg">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
