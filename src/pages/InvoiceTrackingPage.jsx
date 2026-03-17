import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Plus, AlertTriangle, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTestMode } from '../context/TestModeContext'
import { useEmployees } from '../context/EmployeesContext'
import { useWarehouses } from '../context/WarehousesContext'
import { formatDate, toInputDate, parseDate } from '../utils/dateFormat'
import { sortBySerial } from '../utils/serialSort'
import * as esdInvoicesApi from '../api/invoices'
import * as autocountInvoicesApi from '../api/autocountInvoices'
import DeliverySlotModal from '../components/DeliverySlotModal'
import DiscrepancyModal from '../components/DiscrepancyModal'
import SelectSalesmanModal from '../components/SelectSalesmanModal'
import SelectClerkModal from '../components/SelectClerkModal'
import SelectWarehouseModal from '../components/SelectWarehouseModal'
import HoldWarehouseTypeModal from '../components/HoldWarehouseTypeModal'
import SelectDriverModal from '../components/SelectDriverModal'
import NoticeModal from '../components/NoticeModal'
import { useRealtimeTable } from '../hooks/useRealtimeTable'

function getTodayDateStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isSupabaseId(id) {
  return typeof id === 'string' && UUID_REGEX.test(id)
}
/** Local storage: row already saved once (has local_ id) */
function isLocalId(id) {
  return typeof id === 'string' && id.startsWith('local_')
}

const STATUS_OPTIONS = [
  'Billed',
  'Preparing Delivery',
  'Delivery In Progress',
  'Delivered',
  'Hold - Office',
  'Hold - Warehouse',
  'Hold - Salesman',
  'Chop & Sign - Office',
  'Chop & Sign - Warehouse',
  'Chop & Sign - Salesman',
  'Transfer',
  'Completed',
  'Cancelled',
]

const STATUS_REQUIRES_SALESMAN = ['Hold - Salesman', 'Chop & Sign - Salesman']
const STATUS_REQUIRES_CLERK = ['Hold - Office', 'Chop & Sign - Office']
const STATUS_TRANSFER = 'Transfer'

// Phases for workflow / backtrack detection
const PHASE_1 = ['Billed']
const PHASE_2 = [
  'Preparing Delivery',
  'Hold - Office',
  'Hold - Warehouse',
  'Hold - Salesman',
  'Chop & Sign - Office',
  'Chop & Sign - Warehouse',
  'Chop & Sign - Salesman',
  'Transfer',
]
const PHASE_3 = ['Delivery In Progress']
const PHASE_4 = ['Delivered']
const PHASE_5 = ['Completed', 'Cancelled']

function getPhase(status) {
  if (PHASE_1.includes(status)) return 1
  if (PHASE_2.includes(status)) return 2
  if (PHASE_3.includes(status)) return 3
  if (PHASE_4.includes(status)) return 4
  if (PHASE_5.includes(status)) return 5
  return 1
}

// Max duration (in days) the current status can be in without triggering an alert
function getStatusMaxDays(status) {
  if (status === 'Cancelled') return 999
  if (PHASE_1.includes(status)) return 1
  if (status === 'Preparing Delivery') return 3
  if (PHASE_2.includes(status)) return 4
  if (PHASE_3.includes(status)) return 1.5
  if (PHASE_4.includes(status)) return 1
  if (PHASE_5.includes(status)) return 1
  return 1
}

function isStatusOverdue(row) {
  const updatedAt = row?.statusUpdatedAt
  if (!updatedAt) return false
  const updated = new Date(updatedAt).getTime()
  const now = Date.now()
  const maxDays = getStatusMaxDays(row.status)
  const maxMs = maxDays * 24 * 60 * 60 * 1000
  return now - updated > maxMs
}

const DELIVERED_VALIDATION_MSG = 'Assigned person and date is missing, please go to preparing delivery.'
const DELIVERY_IN_PROGRESS_VALIDATION_MSG = 'Driver and Delivery date yet to be assigned.'
const PHASE_4_LOCKED_MSG = 'This Status can no longer be changed as the order has been completed.'

const defaultDiscrepancy = () => ({ checked: false, title: '', description: '' })

function createInvoice(overrides = {}) {
  return {
    id: String(Date.now() + Math.random()),
    invoiceNo: '',
    dateOfInvoice: '',
    status: 'Billed',
    statusUpdatedAt: new Date().toISOString(),
    assignedDriverId: null,
    assignedSalesmanId: null,
    assignedClerkId: null,
    transferWarehouseId: null,
    holdWarehouseId: null,
    holdWarehouseType: '',
    deliveryDate: '',
    deliverySlot: '',
    remark: '',
    remarkAtBilled: '', // kept when backtracking from Phase 2 to Billed
    cod: false,
    discrepancy: defaultDiscrepancy(),
    ...overrides,
  }
}

export default function InvoiceTrackingPage({ useAutocountStorage }) {
  const api = useAutocountStorage ? autocountInvoicesApi : esdInvoicesApi
  const fetchInvoices = api.fetchInvoices
  const insertInvoice = api.insertInvoice
  const updateInvoice = api.updateInvoice
  const deleteInvoice = api.deleteInvoice
  const pageTitle = useAutocountStorage ? 'Autocount Invoice Tracking' : 'ESD Invoice Tracking'
  const { isSuperuser } = useAuth()
  const { testMode } = useTestMode()
  const { employees } = useEmployees()
  const { warehouses } = useWarehouses()
  const drivers = employees.filter((e) => e.position === 'Lorry Driver')
  const salesmen = employees.filter((e) => e.position === 'Salesman')
  const canUseTestMode = testMode && isSuperuser
  const [invoices, setInvoices] = useState([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [deliveryModal, setDeliveryModal] = useState({ open: false, rowId: null, dateLabel: '' })
  const [discrepancyModal, setDiscrepancyModal] = useState({
    open: false,
    rowId: null,
    title: '',
    description: '',
  })
  const [datePickerRow, setDatePickerRow] = useState(null)
  const [invoiceDatePickerRow, setInvoiceDatePickerRow] = useState(null)
  const [salesmanModal, setSalesmanModal] = useState({ open: false, rowId: null, previousStatus: '' })
  const [clerkModal, setClerkModal] = useState({ open: false, rowId: null, previousStatus: '' })
  const [warehouseModal, setWarehouseModal] = useState({ open: false, rowId: null, previousStatus: '' })
  const [holdWarehouseModal, setHoldWarehouseModal] = useState({ open: false, rowId: null, previousStatus: '' })
  const [chopSignNoWarehouseModal, setChopSignNoWarehouseModal] = useState({
    open: false,
    rowId: null,
    previousStatus: '',
  })
  const [holdWarehouseTypeModal, setHoldWarehouseTypeModal] = useState({
    open: false,
    rowId: null,
    warehouseId: null,
    warehouseName: '',
    previousStatus: '',
  })
  const [deliveredNoticeOpen, setDeliveredNoticeOpen] = useState(false)
  const [deliveryInProgressNoticeOpen, setDeliveryInProgressNoticeOpen] = useState(false)
  const [sameStatusConfirmModal, setSameStatusConfirmModal] = useState({
    open: false,
    rowId: null,
    status: '',
  })
  const [assignDateModal, setAssignDateModal] = useState({
    open: false,
    rowId: null,
    selectedDate: '',
    fromDriver: false,
  })
  const [preparingDeliveryTypeModal, setPreparingDeliveryTypeModal] = useState({
    open: false,
    rowId: null,
    previousStatus: '',
  })
  const [driverModal, setDriverModal] = useState({ open: false, rowId: null, previousStatus: '', fromChopSignWarehouse: false })
  const [rearrangeDeliveryConfirmModal, setRearrangeDeliveryConfirmModal] = useState({
    open: false,
    rowId: null,
  })
  const [completedConfirmModal, setCompletedConfirmModal] = useState({ open: false, rowId: null })
  const [cancelledConfirmModal, setCancelledConfirmModal] = useState({ open: false, rowId: null })
  const [chopSignWarehouseConfirmModal, setChopSignWarehouseConfirmModal] = useState({
    open: false,
    rowId: null,
    previousStatus: '',
  })
  const [phase4LockedNoticeOpen, setPhase4LockedNoticeOpen] = useState(false)
  const [backtrackPhase2To1Modal, setBacktrackPhase2To1Modal] = useState({ open: false, rowId: null })
  const [backtrackPhase3To1Modal, setBacktrackPhase3To1Modal] = useState({ open: false, rowId: null })
  const [phase3ToOtherPhase2Modal, setPhase3ToOtherPhase2Modal] = useState({
    open: false,
    rowId: null,
    newStatus: '',
    previousStatus: '',
  })
  const [phase4BacktrackModal, setPhase4BacktrackModal] = useState({
    open: false,
    rowId: null,
    newStatus: '',
    previousStatus: '',
  })
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([])
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('')
  const [bulkApplyConfirmModal, setBulkApplyConfirmModal] = useState({
    open: false,
    rowIds: [],
    payload: null,
    onApplied: null,
  })
  const filteredInvoices = useMemo(() => {
    const q = (invoiceSearchQuery || '').trim().toLowerCase()
    const list = !q
      ? invoices
      : invoices.filter((row) =>
          (row.invoiceNo || '').toLowerCase().includes(q)
        )
    return sortBySerial(list, (row) => row.invoiceNo)
  }, [invoices, invoiceSearchQuery])
  const assignDatePendingRef = useRef({
    rowId: null,
    fromDriver: false,
    fromChopSignWarehouse: false,
    fromChopSignNoFlow: null,
  })
  const pendingBulkRowIdsRef = useRef(null)

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    try {
      const data = await fetchInvoices()
      setInvoices(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Fetch invoices error:', e)
      setInvoices([])
    }
    setInvoicesLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  useRealtimeTable(useAutocountStorage ? 'invoices_autocount' : 'invoices', setInvoices)

  const [highlightRowId, setHighlightRowId] = useState(null)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.startsWith('#row-')) return
    const rowId = hash.slice(5)
    const el = document.getElementById(hash.slice(1))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setHighlightRowId(rowId)
      const t = setTimeout(() => setHighlightRowId(null), 1000)
      return () => clearTimeout(t)
    }
  }, [invoices])

  const updateRow = (id, updates) => {
    const withTimestamp =
      updates.status !== undefined
        ? { ...updates, statusUpdatedAt: new Date().toISOString() }
        : updates
    setInvoices((prev) => {
      const next = prev.map((row) => (row.id === id ? { ...row, ...withTimestamp } : row))
      const row = next.find((r) => r.id === id)
      if (!row) return next
      updateInvoice(id, row)
        .then((updated) => {
          if (updated) setInvoices((p) => p.map((r) => (r.id === id ? updated : r)))
        })
        .catch((e) => console.error('Update invoice error:', e))
      return next
    })
  }

  const deleteRow = (id) => {
    if (!canUseTestMode) return
    deleteInvoice(id)
      .then(() => setInvoices((prev) => prev.filter((row) => row.id !== id)))
      .catch((e) => console.error('Delete invoice error:', e))
  }

  const isBulkApply = () => {
    const ids = pendingBulkRowIdsRef.current
    return ids && Array.isArray(ids) && ids.length > 1
  }

  const afterBulkableCommit = (leadRowId, payload, onApplied) => {
    if (isBulkApply()) {
      const rowIds = pendingBulkRowIdsRef.current
      setBulkApplyConfirmModal({
        open: true,
        rowIds: [...rowIds],
        payload: { ...payload },
        onApplied: () => {
          pendingBulkRowIdsRef.current = null
          onApplied?.()
        },
      })
    } else {
      pendingBulkRowIdsRef.current = null
      onApplied?.()
    }
  }

  const handleBulkApplyYes = () => {
    const { rowIds, payload, onApplied } = bulkApplyConfirmModal
    if (payload && rowIds.length) {
      rowIds.forEach((id) => updateRow(id, { ...payload }))
    }
    setSelectedInvoiceIds([])
    setBulkApplyConfirmModal({ open: false, rowIds: [], payload: null, onApplied: null })
    onApplied?.()
  }

  const handleBulkApplyNo = () => {
    const { onApplied } = bulkApplyConfirmModal
    setBulkApplyConfirmModal({ open: false, rowIds: [], payload: null, onApplied: null })
    onApplied?.()
  }

  const handleDateChange = (rowId, value) => {
    const parsed = parseDate(value)
    if (!parsed) return
    setDatePickerRow(null)
    const row = invoices.find((r) => r.id === rowId)
    const isHoldOrChopSign =
      row?.status?.startsWith('Hold -') || row?.status?.startsWith('Chop & Sign -')
    if (isHoldOrChopSign) {
      updateRow(rowId, { deliveryDate: parsed, deliverySlot: '' })
      return
    }
    setDeliveryModal({ open: true, rowId, dateLabel: formatDate(parsed) })
    updateRow(rowId, { deliveryDate: parsed, deliverySlot: '' })
  }

  const handleInvoiceDateChange = (rowId, value) => {
    const parsed = parseDate(value)
    if (parsed) updateRow(rowId, { dateOfInvoice: parsed })
    setInvoiceDatePickerRow(null)
  }

  const handleDeliverySlotSelect = (slot) => {
    if (!deliveryModal.rowId) return
    const displaySlot = slot === 'Afternoon' ? 'Noon' : slot
    const row = invoices.find((r) => r.id === deliveryModal.rowId)
    const payload = row
      ? {
          status: row.status,
          assignedSalesmanId: row.assignedSalesmanId,
          assignedDriverId: row.assignedDriverId,
          deliveryDate: row?.deliveryDate ?? '',
          deliverySlot: displaySlot,
        }
      : { deliverySlot: displaySlot, deliveryDate: '' }
    updateRow(deliveryModal.rowId, payload)
    afterBulkableCommit(deliveryModal.rowId, payload, () =>
      setDeliveryModal({ open: false, rowId: null, dateLabel: '' })
    )
  }

  const handleDiscrepancyCheck = (rowId, checked) => {
    if (checked) {
      const row = invoices.find((r) => r.id === rowId)
      updateRow(rowId, { discrepancy: { ...row.discrepancy, checked: true } })
      setDiscrepancyModal({
        open: true,
        rowId,
        title: row?.discrepancy?.title || '',
        description: row?.discrepancy?.description || '',
      })
    } else {
      updateRow(rowId, { discrepancy: defaultDiscrepancy() })
    }
  }

  const handleDiscrepancySave = (rowId, { title, description }) => {
    updateRow(rowId, {
      discrepancy: { checked: true, title, description },
    })
    setDiscrepancyModal({ open: false, rowId: null, title: '', description: '' })
  }

  const handleDiscrepancyCancel = (rowId) => {
    updateRow(rowId, { discrepancy: defaultDiscrepancy() })
    setDiscrepancyModal({ open: false, rowId: null, title: '', description: '' })
  }

  const handleStatusChange = (rowId, newStatus, previousStatus) => {
    const row = invoices.find((r) => r.id === rowId)
    if (newStatus === row.status) {
      setSameStatusConfirmModal({ open: true, rowId, status: newStatus })
      return
    }
    if (
      selectedInvoiceIds.includes(rowId)
    ) {
      pendingBulkRowIdsRef.current = [...selectedInvoiceIds]
    } else {
      pendingBulkRowIdsRef.current = null
    }
    const currentPhase = getPhase(row.status)
    const newPhase = getPhase(newStatus)

    // Phase 5 (Completed) cannot backtrack to any earlier phase (unless Test Mode is on)
    if (currentPhase === 5 && newPhase < 5 && !canUseTestMode) {
      setPhase4LockedNoticeOpen(true)
      return
    }

    // Phase 2 → Phase 1 (Billed): confirm backtrack and reset progress
    if (currentPhase === 2 && newStatus === 'Billed') {
      setBacktrackPhase2To1Modal({ open: true, rowId })
      return
    }

    // Phase 3 → Phase 1 (Billed): confirm backtrack and reset progress
    if (currentPhase === 3 && newStatus === 'Billed') {
      setBacktrackPhase3To1Modal({ open: true, rowId })
      return
    }

    // Phase 4 (Delivered) → Phase 1, 2, or 3: confirm backtrack, reset assignments and remark
    if (currentPhase === 4 && newPhase < 4) {
      setPhase4BacktrackModal({
        open: true,
        rowId,
        newStatus,
        previousStatus: row.status,
      })
      return
    }

    // Phase 3 or 4 → Phase 2: Preparing Delivery = "redeliver?"; other = "sure?"
    if ((currentPhase === 3 || currentPhase === 4) && newPhase === 2) {
      if (newStatus === 'Preparing Delivery') {
        setRearrangeDeliveryConfirmModal({ open: true, rowId })
        return
      }
      setPhase3ToOtherPhase2Modal({
        open: true,
        rowId,
        newStatus,
        previousStatus: row.status,
      })
      return
    }

    if (newStatus === 'Delivered') {
      const hasAssignedPerson = row.assignedDriverId || row.assignedSalesmanId
      const hasDeliveryDate = !!row.deliveryDate
      if (!hasAssignedPerson || !hasDeliveryDate) {
        setDeliveredNoticeOpen(true)
        return
      }
    }
    if (newStatus === 'Completed') {
      setCompletedConfirmModal({ open: true, rowId })
      return
    }
    if (newStatus === 'Cancelled') {
      setCancelledConfirmModal({ open: true, rowId })
      return
    }
    const clearDriverForHoldOrChop =
      newStatus.startsWith('Hold -') || newStatus.startsWith('Chop & Sign -')
    const fromBilledToPhase2 = row.status === 'Billed' && newPhase === 2
    const remarkAtBilledUpdate = fromBilledToPhase2 ? { remarkAtBilled: row.remark ?? '' } : {}
    if (newStatus === 'Delivery In Progress') {
      updateRow(rowId, {
        status: newStatus,
        assignedSalesmanId: null,
        assignedDriverId: null,
        ...remarkAtBilledUpdate,
      })
      setPreparingDeliveryTypeModal({ open: true, rowId, previousStatus })
    } else if (STATUS_REQUIRES_SALESMAN.includes(newStatus)) {
      updateRow(rowId, { status: newStatus, assignedDriverId: null, ...remarkAtBilledUpdate })
      setSalesmanModal({ open: true, rowId, previousStatus })
    } else if (STATUS_REQUIRES_CLERK.includes(newStatus)) {
      updateRow(rowId, { status: newStatus, assignedDriverId: null, ...remarkAtBilledUpdate })
      setClerkModal({ open: true, rowId, previousStatus })
    } else if (newStatus === STATUS_TRANSFER) {
      updateRow(rowId, { status: newStatus, ...remarkAtBilledUpdate })
      setWarehouseModal({ open: true, rowId, previousStatus })
    } else if (newStatus === 'Hold - Warehouse') {
      updateRow(rowId, { status: newStatus, assignedDriverId: null, ...remarkAtBilledUpdate })
      setHoldWarehouseModal({ open: true, rowId, previousStatus })
    } else if (newStatus === 'Chop & Sign - Warehouse') {
      setChopSignWarehouseConfirmModal({ open: true, rowId, previousStatus })
      return
    } else {
      const payload = {
        status: newStatus,
        assignedSalesmanId: null,
        assignedClerkId: null,
        transferWarehouseId: null,
        ...(clearDriverForHoldOrChop ? { assignedDriverId: null } : {}),
        ...remarkAtBilledUpdate,
      }
      updateRow(rowId, payload)
      afterBulkableCommit(rowId, payload, () => {})
    }
  }

  const handleSalesmanSelect = (rowId, salesmanId) => {
    updateRow(rowId, { assignedSalesmanId: salesmanId })
    setSalesmanModal({ open: false, rowId: null, previousStatus: '' })
    const row = invoices.find((r) => r.id === rowId)
    assignDatePendingRef.current = { rowId, fromDriver: false }
    setAssignDateModal({
      open: true,
      rowId,
      selectedDate: row?.deliveryDate || getTodayDateStr(),
      fromDriver: false,
    })
  }

  const handleSalesmanModalCancel = (rowId, previousStatus) => {
    updateRow(rowId, { status: previousStatus, assignedSalesmanId: null })
    setSalesmanModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleClerkSelect = (rowId, clerkId) => {
    updateRow(rowId, { assignedClerkId: clerkId })
    setClerkModal({ open: false, rowId: null, previousStatus: '' })
    const row = invoices.find((r) => r.id === rowId)
    assignDatePendingRef.current = { rowId, fromDriver: false }
    setAssignDateModal({
      open: true,
      rowId,
      selectedDate: row?.deliveryDate || getTodayDateStr(),
      fromDriver: false,
    })
  }

  const handleClerkModalCancel = (rowId, previousStatus) => {
    updateRow(rowId, { status: previousStatus, assignedClerkId: null })
    setClerkModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleWarehouseSelect = (rowId, warehouseId) => {
    const payload = {
      transferWarehouseId: warehouseId,
      deliveryDate: getTodayDateStr(),
      deliverySlot: '',
    }
    updateRow(rowId, payload)
    afterBulkableCommit(rowId, payload, () => setWarehouseModal({ open: false, rowId: null, previousStatus: '' }))
  }

  const handleWarehouseModalCancel = (rowId, previousStatus) => {
    updateRow(rowId, { status: previousStatus, transferWarehouseId: null })
    setWarehouseModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleHoldWarehouseSelect = (rowId, warehouseId) => {
    const warehouse = warehouses.find((w) => w.id === warehouseId)
    setHoldWarehouseModal({ open: false, rowId: null, previousStatus: '' })
    if (warehouse?.name?.toLowerCase() === 'keruing') {
      const payload = {
        status: 'Hold - Warehouse',
        holdWarehouseId: warehouseId,
        holdWarehouseType: null,
        assignedDriverId: null,
        deliveryDate: getTodayDateStr(),
        deliverySlot: '',
      }
      updateRow(rowId, payload)
      afterBulkableCommit(rowId, payload, () => {})
      return
    }
    setHoldWarehouseTypeModal({
      open: true,
      rowId,
      warehouseId,
      warehouseName: warehouse?.name || '',
      previousStatus: holdWarehouseModal.previousStatus,
    })
  }

  const handleHoldWarehouseModalCancel = () => {
    updateRow(holdWarehouseModal.rowId, { status: holdWarehouseModal.previousStatus, assignedDriverId: null })
    setHoldWarehouseModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleChopSignNoWarehouseSelect = (rowId, warehouseId) => {
    setChopSignNoWarehouseModal({ open: false, rowId: null, previousStatus: '' })
    assignDatePendingRef.current = {
      rowId: null,
      fromDriver: false,
      fromChopSignWarehouse: false,
      fromChopSignNoFlow: { rowId, warehouseId },
    }
    const row = invoices.find((r) => r.id === rowId)
    setAssignDateModal({
      open: true,
      rowId,
      selectedDate: row?.deliveryDate || getTodayDateStr(),
      fromDriver: false,
    })
  }

  const handleChopSignNoWarehouseCancel = () => {
    setChopSignNoWarehouseModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleHoldWarehouseTypeSelect = (type) => {
    const { rowId, warehouseId } = holdWarehouseTypeModal
    const row = invoices.find((r) => r.id === rowId)
    const currentRemark = row?.remark?.trim() || ''
    const newRemark = currentRemark ? `${currentRemark} / ${type}` : type
    const payload = {
      status: 'Hold - Warehouse',
      holdWarehouseId: warehouseId,
      holdWarehouseType: type,
      assignedDriverId: null,
      deliveryDate: getTodayDateStr(),
      deliverySlot: '',
      remark: newRemark,
    }
    updateRow(rowId, payload)
    afterBulkableCommit(rowId, payload, () =>
      setHoldWarehouseTypeModal({ open: false, rowId: null, warehouseId: null, warehouseName: '', previousStatus: '' })
    )
  }

  const handleHoldWarehouseTypeCancel = () => {
    updateRow(holdWarehouseTypeModal.rowId, {
      status: holdWarehouseTypeModal.previousStatus,
      assignedDriverId: null,
    })
    setHoldWarehouseTypeModal({ open: false, rowId: null, warehouseId: null, warehouseName: '', previousStatus: '' })
  }

  const handleSameStatusStartOver = () => {
    const { rowId, status } = sameStatusConfirmModal
    setSameStatusConfirmModal({ open: false, rowId: null, status: '' })
    if (STATUS_REQUIRES_SALESMAN.includes(status)) {
      updateRow(rowId, { assignedSalesmanId: null })
      setSalesmanModal({ open: true, rowId, previousStatus: status })
    } else if (STATUS_REQUIRES_CLERK.includes(status)) {
      updateRow(rowId, { assignedClerkId: null })
      setClerkModal({ open: true, rowId, previousStatus: status })
    } else if (status === STATUS_TRANSFER) {
      updateRow(rowId, { transferWarehouseId: null })
      setWarehouseModal({ open: true, rowId, previousStatus: status })
    } else if (status === 'Hold - Warehouse') {
      updateRow(rowId, { holdWarehouseId: null, holdWarehouseType: null })
      setHoldWarehouseModal({ open: true, rowId, previousStatus: status })
    } else if (status === 'Chop & Sign - Warehouse') {
      setChopSignWarehouseConfirmModal({ open: true, rowId, previousStatus: status })
    } else if (status === 'Delivery In Progress') {
      updateRow(rowId, { assignedSalesmanId: null, assignedDriverId: null })
      setPreparingDeliveryTypeModal({ open: true, rowId, previousStatus: status })
    }
  }

  const handleSameStatusConfirmClose = () => {
    setSameStatusConfirmModal({ open: false, rowId: null, status: '' })
  }

  const handleRearrangeDeliveryYes = () => {
    const { rowId } = rearrangeDeliveryConfirmModal
    const payload = rowId
      ? {
          status: 'Preparing Delivery',
          assignedDriverId: null,
          assignedSalesmanId: null,
          deliveryDate: '',
          deliverySlot: '',
        }
      : null
    if (rowId && payload) updateRow(rowId, payload)
    afterBulkableCommit(rowId, payload || {}, () => setRearrangeDeliveryConfirmModal({ open: false, rowId: null }))
  }

  const handleRearrangeDeliveryNo = () => {
    setRearrangeDeliveryConfirmModal({ open: false, rowId: null })
  }

  const handleBacktrackPhase2To1Yes = () => {
    const { rowId } = backtrackPhase2To1Modal
    const row = invoices.find((r) => r.id === rowId)
    const payload = rowId && row ? {
      status: 'Billed',
      assignedDriverId: null,
      assignedSalesmanId: null,
      assignedClerkId: null,
      transferWarehouseId: null,
      holdWarehouseId: null,
      holdWarehouseType: '',
      deliveryDate: '',
      deliverySlot: '',
      remark: row.remarkAtBilled ?? '',
    } : null
    if (rowId && payload) {
      updateRow(rowId, payload)
      afterBulkableCommit(rowId, payload, () => setBacktrackPhase2To1Modal({ open: false, rowId: null }))
    } else {
      setBacktrackPhase2To1Modal({ open: false, rowId: null })
    }
  }

  const handleBacktrackPhase2To1No = () => {
    setBacktrackPhase2To1Modal({ open: false, rowId: null })
  }

  const handleBacktrackPhase3To1Yes = () => {
    const { rowId } = backtrackPhase3To1Modal
    const row = invoices.find((r) => r.id === rowId)
    const payload = rowId && row ? {
      status: 'Billed',
      assignedDriverId: null,
      assignedSalesmanId: null,
      assignedClerkId: null,
      transferWarehouseId: null,
      holdWarehouseId: null,
      holdWarehouseType: '',
      deliveryDate: '',
      deliverySlot: '',
      remark: row.remarkAtBilled ?? '',
    } : null
    if (rowId && payload) {
      updateRow(rowId, payload)
      afterBulkableCommit(rowId, payload, () => setBacktrackPhase3To1Modal({ open: false, rowId: null }))
    } else {
      setBacktrackPhase3To1Modal({ open: false, rowId: null })
    }
  }

  const handleBacktrackPhase3To1No = () => {
    setBacktrackPhase3To1Modal({ open: false, rowId: null })
  }

  const handlePhase3ToOtherPhase2Yes = () => {
    const { rowId, newStatus, previousStatus } = phase3ToOtherPhase2Modal
    if (!rowId) {
      setPhase3ToOtherPhase2Modal({ open: false, rowId: null, newStatus: '', previousStatus: '' })
      return
    }
    const resetPhase3Fields = {
      assignedDriverId: null,
      assignedSalesmanId: null,
      assignedClerkId: null,
      deliveryDate: '',
      deliverySlot: '',
      transferWarehouseId: null,
      holdWarehouseId: null,
      holdWarehouseType: '',
    }
    const payload = { status: newStatus, ...resetPhase3Fields }
    updateRow(rowId, payload)
    afterBulkableCommit(rowId, payload, () => {
      setPhase3ToOtherPhase2Modal({ open: false, rowId: null, newStatus: '', previousStatus: '' })
      if (newStatus === 'Preparing Delivery') {
        // no modal for Preparing Delivery, just status + resets
      } else if (STATUS_REQUIRES_SALESMAN.includes(newStatus)) {
        setSalesmanModal({ open: true, rowId, previousStatus })
      } else if (STATUS_REQUIRES_CLERK.includes(newStatus)) {
        setClerkModal({ open: true, rowId, previousStatus })
      } else if (newStatus === STATUS_TRANSFER) {
        setWarehouseModal({ open: true, rowId, previousStatus })
      } else if (newStatus === 'Hold - Warehouse') {
        setHoldWarehouseModal({ open: true, rowId, previousStatus })
      } else if (newStatus === 'Chop & Sign - Warehouse') {
        setChopSignWarehouseConfirmModal({
          open: true,
          rowId,
          previousStatus,
        })
      }
    })
  }

  const handlePhase3ToOtherPhase2No = () => {
    setPhase3ToOtherPhase2Modal({ open: false, rowId: null, newStatus: '', previousStatus: '' })
  }

  const handlePhase4BacktrackYes = () => {
    const { rowId, newStatus, previousStatus } = phase4BacktrackModal
    if (!rowId) {
      setPhase4BacktrackModal({ open: false, rowId: null, newStatus: '', previousStatus: '' })
      return
    }
    const row = invoices.find((r) => r.id === rowId)
    const resetPayload = {
      status: newStatus,
      assignedDriverId: null,
      assignedSalesmanId: null,
      assignedClerkId: null,
      deliveryDate: '',
      deliverySlot: '',
      transferWarehouseId: null,
      holdWarehouseId: null,
      holdWarehouseType: '',
      remark: row?.remarkAtBilled ?? '',
    }
    updateRow(rowId, resetPayload)
    afterBulkableCommit(rowId, resetPayload, () => {
      setPhase4BacktrackModal({ open: false, rowId: null, newStatus: '', previousStatus: '' })
      if (newStatus === 'Delivery In Progress') {
        setPreparingDeliveryTypeModal({ open: true, rowId, previousStatus: '' })
      } else if (STATUS_REQUIRES_SALESMAN.includes(newStatus)) {
        setSalesmanModal({ open: true, rowId, previousStatus })
      } else if (STATUS_REQUIRES_CLERK.includes(newStatus)) {
        setClerkModal({ open: true, rowId, previousStatus })
      } else if (newStatus === STATUS_TRANSFER) {
        setWarehouseModal({ open: true, rowId, previousStatus })
      } else if (newStatus === 'Hold - Warehouse') {
        setHoldWarehouseModal({ open: true, rowId, previousStatus })
      } else if (newStatus === 'Chop & Sign - Warehouse') {
        setChopSignWarehouseConfirmModal({ open: true, rowId, previousStatus })
      }
    })
  }

  const handlePhase4BacktrackNo = () => {
    setPhase4BacktrackModal({ open: false, rowId: null, newStatus: '', previousStatus: '' })
  }

  const handleCompletedConfirmYes = () => {
    const { rowId } = completedConfirmModal
    const payload = { status: 'Completed' }
    if (rowId) updateRow(rowId, payload)
    afterBulkableCommit(rowId, payload, () => setCompletedConfirmModal({ open: false, rowId: null }))
  }

  const handleCompletedConfirmNo = () => {
    setCompletedConfirmModal({ open: false, rowId: null })
  }

  const handleCancelledConfirmYes = () => {
    const { rowId } = cancelledConfirmModal
    const payload = { status: 'Cancelled' }
    if (rowId) updateRow(rowId, payload)
    afterBulkableCommit(rowId, payload, () => setCancelledConfirmModal({ open: false, rowId: null }))
  }

  const handleCancelledConfirmNo = () => {
    setCancelledConfirmModal({ open: false, rowId: null })
  }

  const handleChopSignWarehouseNo = () => {
    const { rowId, previousStatus } = chopSignWarehouseConfirmModal
    setChopSignWarehouseConfirmModal({ open: false, rowId: null, previousStatus: '' })
    setChopSignNoWarehouseModal({ open: true, rowId, previousStatus })
  }

  const handleChopSignWarehouseYes = () => {
    const { rowId, previousStatus } = chopSignWarehouseConfirmModal
    if (rowId) updateRow(rowId, { status: 'Chop & Sign - Warehouse', assignedDriverId: null })
    setChopSignWarehouseConfirmModal({ open: false, rowId: null, previousStatus: '' })
    setDriverModal({ open: true, rowId, previousStatus, fromChopSignWarehouse: true })
  }

  const handleAssignDateConfirm = () => {
    const ref = assignDatePendingRef.current
    const { rowId: refRowId, fromDriver, fromChopSignWarehouse, fromChopSignNoFlow } = ref
    const rowIdToUse = refRowId ?? assignDateModal.rowId
    const dateStr = assignDateModal.selectedDate || getTodayDateStr()
    const parsed = parseDate(dateStr)
    const dateToSave = parsed || getTodayDateStr()

    assignDatePendingRef.current = {
      rowId: null,
      fromDriver: false,
      fromChopSignWarehouse: false,
      fromChopSignNoFlow: null,
    }
    setAssignDateModal({ open: false, rowId: null, selectedDate: '', fromDriver: false })

    try {
      if (rowIdToUse) {
        if (fromChopSignNoFlow) {
          const { warehouseId } = fromChopSignNoFlow
          const row = invoices.find((r) => r.id === rowIdToUse)
          const currentRemark = row?.remark?.trim() || ''
          const newRemark = currentRemark ? `${currentRemark} / Chop & Sign` : 'Chop & Sign'
          const payload = {
            status: 'Hold - Warehouse',
            holdWarehouseId: warehouseId,
            holdWarehouseType: '',
            assignedDriverId: null,
            deliveryDate: dateToSave,
            deliverySlot: '',
            remark: newRemark,
          }
          updateRow(rowIdToUse, payload)
          afterBulkableCommit(rowIdToUse, payload, () => {})
          return
        }
        if (fromChopSignWarehouse) {
          const row = invoices.find((r) => r.id === rowIdToUse)
          const currentRemark = row?.remark?.trim() || ''
          const newRemark = currentRemark ? `${currentRemark} / Chop & Sign` : 'Chop & Sign'
          const payload = {
            status: 'Delivery In Progress',
            deliveryDate: dateToSave,
            deliverySlot: '',
            remark: newRemark,
          }
          updateRow(rowIdToUse, payload)
          afterBulkableCommit(rowIdToUse, payload, () => {})
          return
        }
        updateRow(rowIdToUse, { deliveryDate: dateToSave, deliverySlot: '' })
        if (fromDriver) {
          setDeliveryModal({ open: true, rowId: rowIdToUse, dateLabel: formatDate(dateToSave) })
        } else {
          const leadRow = invoices.find((r) => r.id === rowIdToUse)
          const payload = leadRow
            ? {
                status: leadRow.status,
                assignedSalesmanId: leadRow.assignedSalesmanId,
                assignedDriverId: leadRow.assignedDriverId,
                deliveryDate: dateToSave,
                deliverySlot: '',
              }
            : { deliveryDate: dateToSave, deliverySlot: '' }
          afterBulkableCommit(rowIdToUse, payload, () => {})
        }
      }
    } catch (e) {
      console.error('Assign date confirm error:', e)
    }
  }

  const handleAssignDateCancel = () => {
    assignDatePendingRef.current = {
      rowId: null,
      fromDriver: false,
      fromChopSignWarehouse: false,
      fromChopSignNoFlow: null,
    }
    setAssignDateModal({ open: false, rowId: null, selectedDate: '', fromDriver: false })
  }

  const handlePreparingDeliveryTypeSelect = (type) => {
    const { rowId, previousStatus } = preparingDeliveryTypeModal
    setPreparingDeliveryTypeModal({ open: false, rowId: null, previousStatus: '' })
    if (type === 'Salesman') {
      setSalesmanModal({ open: true, rowId, previousStatus })
    } else {
      setDriverModal({ open: true, rowId, previousStatus })
    }
  }

  const handlePreparingDeliveryTypeCancel = () => {
    const { rowId, previousStatus } = preparingDeliveryTypeModal
    updateRow(rowId, { status: previousStatus })
    setPreparingDeliveryTypeModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleDriverSelect = (rowId, driverId) => {
    const fromChopSignWarehouse = driverModal.fromChopSignWarehouse
    updateRow(rowId, { assignedDriverId: driverId })
    setDriverModal({ open: false, rowId: null, previousStatus: '', fromChopSignWarehouse: false })
    const row = invoices.find((r) => r.id === rowId)
    assignDatePendingRef.current = { rowId, fromDriver: true, fromChopSignWarehouse: !!fromChopSignWarehouse }
    setAssignDateModal({
      open: true,
      rowId,
      selectedDate: row?.deliveryDate || getTodayDateStr(),
      fromDriver: true,
    })
  }

  const handleDriverModalCancel = (rowId, previousStatus) => {
    updateRow(rowId, { status: previousStatus, assignedDriverId: null })
    setDriverModal({ open: false, rowId: null, previousStatus: '', fromChopSignWarehouse: false })
  }

  const handleAddInvoiceRow = async () => {
    const newRow = createInvoice({
      invoiceNo: '',
      dateOfInvoice: getTodayDateStr(),
    })
    try {
      const inserted = await insertInvoice(newRow)
      setInvoices((prev) => [...prev, inserted])
    } catch (e) {
      console.error('Add invoice row error:', e)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2">
        {pageTitle}
      </h1>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <label htmlFor="invoice-no-search" className="text-sm font-medium text-slate-700 shrink-0">
            Invoice No.
          </label>
          <input
            id="invoice-no-search"
            type="text"
            value={invoiceSearchQuery}
            onChange={(e) => setInvoiceSearchQuery(e.target.value)}
            placeholder="Search by invoice no."
            className="py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900 w-48 max-w-full text-sm"
            aria-label="Search by invoice number"
          />
        </div>
        <div className="flex items-center gap-4 shrink-0">
        {canUseTestMode && (
          <button
            type="button"
            onClick={handleAddInvoiceRow}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
          >
            <Plus size={18} />
            Add row
          </button>
        )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
        {invoicesLoading ? (
          <div className="p-8 text-center text-slate-500">Loading invoices…</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {invoiceSearchQuery.trim() ? 'No invoices match your search.' : 'No invoices added yet. Click &quot;Add row&quot; (Test Mode) to add one.'}
          </div>
        ) : (
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-700 w-12">
                <input
                  type="checkbox"
                  checked={filteredInvoices.length > 0 && selectedInvoiceIds.length === filteredInvoices.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedInvoiceIds(filteredInvoices.map((r) => r.id))
                    else setSelectedInvoiceIds([])
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                  aria-label="Select all invoices"
                />
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 w-12" title="Alert when status has exceeded allowed duration">Alert</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 min-w-[7.5rem]">Invoice No</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Date of Invoice</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Assigned To</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Assigned Date</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Remark</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 w-16">C.O.D</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Discrepancy</th>
              {canUseTestMode && <th className="text-left py-3 px-4 font-semibold text-slate-700 w-14">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((row) => {
              const salesman = row.assignedSalesmanId
                ? salesmen.find((s) => s.id === row.assignedSalesmanId)
                : null
              const clerk = row.assignedClerkId
                ? employees.find((e) => e.id === row.assignedClerkId)
                : null
              const transferWarehouse = row.transferWarehouseId
                ? warehouses.find((w) => w.id === row.transferWarehouseId)
                : null
              const holdWarehouse = row.holdWarehouseId
                ? warehouses.find((w) => w.id === row.holdWarehouseId)
                : null
              const assignedDriver = row.assignedDriverId
                ? drivers.find((d) => d.id === row.assignedDriverId)
                : null
              const canEditInvoiceFields = canUseTestMode
              const isRowCompleted = row.status === 'Completed'
              const isRowCancelled = row.status === 'Cancelled'
              const isCompletedLocked = (isRowCompleted || isRowCancelled) && !canUseTestMode
              const canEditRow = canEditInvoiceFields && !isCompletedLocked
              const isDeliveryInProgress = row.status === 'Delivery In Progress'
              const isDelivered = row.status === 'Delivered'
              const isChopSignWarehouse = row.status === 'Chop & Sign - Warehouse'
              const isHoldOffice = row.status === 'Hold - Office'
              const isDriverInactive =
                !isChopSignWarehouse &&
                !isHoldOffice &&
                (row.status === 'Billed' ||
                  row.status === 'Preparing Delivery' ||
                  row.status.startsWith('Hold -') ||
                  row.status.startsWith('Chop & Sign -') ||
                  row.status.startsWith('Transfer') ||
                  row.status === 'Completed' ||
                  row.status === 'Cancelled' ||
                  isDeliveryInProgress ||
                  isDelivered)
              const isAssignedDateInactive = row.status === 'Billed'
              const isHoldWarehouseWithWarehouse = row.status === 'Hold - Warehouse' && row.holdWarehouseId
              const isDriverDateLocked =
                isDeliveryInProgress || isDelivered || isHoldWarehouseWithWarehouse
              const driverMissing = isDeliveryInProgress && !row.assignedDriverId
              const isHoldOrChopSign =
                row.status?.startsWith('Hold -') || row.status?.startsWith('Chop & Sign -')
              const showAssignedPerson =
                (STATUS_REQUIRES_CLERK.includes(row.status) && clerk) ||
                (STATUS_REQUIRES_SALESMAN.includes(row.status) && salesman) ||
                (row.status === 'Delivery In Progress' && (salesman || assignedDriver))
              const assignedPersonName = STATUS_REQUIRES_CLERK.includes(row.status)
                ? (clerk?.name ?? '')
                : STATUS_REQUIRES_SALESMAN.includes(row.status)
                  ? (salesman?.name ?? '')
                  : row.status === 'Delivery In Progress'
                    ? (salesman?.name ?? assignedDriver?.name ?? '')
                    : ''
              const assignedToDisplay =
                row.status === 'Preparing Delivery' || row.status === 'Billed'
                  ? 'Unassigned'
                  : row.status === STATUS_TRANSFER && transferWarehouse
                    ? transferWarehouse.name
                    : row.status === 'Hold - Warehouse' && holdWarehouse
                      ? (holdWarehouse.name || 'Unassigned')
                      : showAssignedPerson
                        ? assignedPersonName
                        : (assignedDriver?.name ?? 'Unassigned')
              const assignedDateDisplay =
                row.deliveryDate && row.deliverySlot
                  ? `${formatDate(row.deliveryDate)} - ${row.deliverySlot}`
                  : row.deliveryDate
                    ? formatDate(row.deliveryDate)
                    : '–'
              const isAssignedDateReadOnlyClerkSalesman =
                STATUS_REQUIRES_CLERK.includes(row.status) ||
                STATUS_REQUIRES_SALESMAN.includes(row.status) ||
                row.status === 'Delivery In Progress' ||
                row.status === 'Preparing Delivery'
              const deliveryDisplay =
                row.deliveryDate && row.deliverySlot
                  ? `${formatDate(row.deliveryDate)} - ${row.deliverySlot}`
                  : row.deliveryDate && isHoldOrChopSign
                    ? formatDate(row.deliveryDate)
                    : ''

              const isInteractive = (el) =>
                el?.closest?.('input, select, button, [role="button"]')
              return (
                <tr
                  id={`row-${row.id}`}
                  key={row.id}
                  className={`border-b border-slate-200 hover:bg-slate-50 ${String(highlightRowId) === String(row.id) ? 'highlight-row' : ''}`}
                  onClick={(e) => {
                    if (isInteractive(e.target)) return
                    setSelectedInvoiceIds((prev) => {
                      if (prev.includes(row.id)) return prev.filter((id) => id !== row.id)
                      return [...prev, row.id]
                    })
                  }}
                >
                  <td className="py-2 px-4 w-12" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedInvoiceIds.includes(row.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvoiceIds((prev) => [...prev, row.id])
                        } else {
                          setSelectedInvoiceIds((prev) => prev.filter((id) => id !== row.id))
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                      aria-label={`Select invoice ${row.invoiceNo || row.id}`}
                    />
                  </td>
                  <td className="py-2 px-4 w-12 text-center" title={isStatusOverdue(row) ? `Status "${row.status}" has exceeded the allowed duration (Phase ${getPhase(row.status)})` : ''}>
                    {isStatusOverdue(row) ? (
                      <AlertTriangle size={20} className="text-amber-500 inline-block" aria-label="Status overdue" />
                    ) : (
                      <span className="text-slate-300" aria-hidden>–</span>
                    )}
                  </td>
                  <td className="py-2 px-4 min-w-[7.5rem]">
                    <input
                      type="text"
                      value={row.invoiceNo}
                      onChange={(e) => updateRow(row.id, { invoiceNo: e.target.value })}
                      readOnly={!canEditRow}
                      className={`w-full min-w-0 max-w-[120px] py-1.5 px-2 border rounded ${
                        canEditRow
                          ? 'border-slate-300 focus:ring-2 focus:ring-blue-900'
                          : 'border-transparent bg-transparent read-only:bg-transparent'
                      }`}
                      style={{ boxSizing: 'border-box' }}
                    />
                  </td>
                  <td className="py-2 px-4">
                    {canEditRow ? (
                      invoiceDatePickerRow === row.id ? (
                        <input
                          type="date"
                          defaultValue={toInputDate(row.dateOfInvoice)}
                          onBlur={(e) => {
                            const v = e.target.value
                            if (v) handleInvoiceDateChange(row.id, v)
                            setInvoiceDatePickerRow(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setInvoiceDatePickerRow(null)
                          }}
                          autoFocus
                          className="py-1.5 px-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 max-w-[140px]"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setInvoiceDatePickerRow(row.id)}
                          className="text-left py-1.5 px-2 rounded hover:bg-slate-100 min-w-[100px]"
                        >
                          {row.dateOfInvoice ? formatDate(row.dateOfInvoice) : 'Select date'}
                        </button>
                      )
                    ) : (
                      <span className="py-1.5 px-2 block text-slate-700">
                        {row.dateOfInvoice ? formatDate(row.dateOfInvoice) : '–'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    {isCompletedLocked ? (
                      <span className="py-1.5 px-2 block min-w-[180px] text-slate-700">
                        {row.status}
                      </span>
                    ) : (
                      <div className="min-w-[180px]">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            handleStatusChange(row.id, e.target.value, row.status)
                          }
                          className="w-full py-1.5 px-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`py-1.5 px-2 block min-w-[140px] ${
                        assignedToDisplay === 'Unassigned' ? 'text-slate-500' : 'text-slate-700'
                      }`}
                    >
                      {assignedToDisplay}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className="py-1.5 px-2 block min-w-[140px] text-slate-700"
                    >
                      {assignedDateDisplay}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={row.remark}
                      onChange={(e) => updateRow(row.id, { remark: e.target.value })}
                      readOnly={!canEditRow}
                      className={`w-full min-w-[100px] py-1.5 px-2 border rounded ${
                        canEditRow
                          ? 'border-slate-300 focus:ring-2 focus:ring-blue-900'
                          : 'border-transparent bg-transparent read-only:bg-transparent'
                      }`}
                      placeholder="Remark"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="checkbox"
                      checked={row.cod ?? false}
                      onChange={(e) => updateRow(row.id, { cod: e.target.checked })}
                      disabled={isCompletedLocked && !canUseTestMode}
                      className="rounded border-slate-300 text-blue-900 focus:ring-blue-900 disabled:opacity-70 disabled:cursor-not-allowed"
                      aria-label="C.O.D"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      {isCompletedLocked ? (
                        <>
                          <input
                            type="checkbox"
                            checked={row.discrepancy?.checked ?? false}
                            disabled
                            className="rounded border-slate-300 text-blue-900 opacity-70 cursor-not-allowed"
                          />
                          {row.discrepancy?.checked && row.discrepancy?.title ? (
                            <span
                              className="relative group/tip max-w-[120px] truncate text-slate-700"
                              title={row.discrepancy?.description}
                            >
                              {row.discrepancy.title}
                              {row.discrepancy.description && (
                                <span className="absolute left-0 bottom-full mb-1 hidden group-hover/tip:block z-10 py-2 px-3 bg-slate-800 text-white text-xs rounded shadow-lg max-w-[220px] whitespace-normal">
                                  {row.discrepancy.description}
                                </span>
                              )}
                            </span>
                          ) : row.discrepancy?.checked ? (
                            <span className="text-slate-500 text-xs">No details</span>
                          ) : null}
                        </>
                      ) : row.discrepancy?.checked ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setDiscrepancyModal({
                                open: true,
                                rowId: row.id,
                                title: row.discrepancy?.title || '',
                                description: row.discrepancy?.description || '',
                              })
                            }
                            className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                            title="Edit discrepancy"
                            aria-label="Edit discrepancy"
                          >
                            <Pencil size={18} />
                          </button>
                          {row.discrepancy?.title ? (
                            <span
                              className="relative group/tip max-w-[120px] truncate text-slate-700"
                              title={row.discrepancy?.description}
                            >
                              {row.discrepancy.title}
                              {row.discrepancy.description && (
                                <span className="absolute left-0 bottom-full mb-1 hidden group-hover/tip:block z-10 py-2 px-3 bg-slate-800 text-white text-xs rounded shadow-lg max-w-[220px] whitespace-normal">
                                  {row.discrepancy.description}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">No details</span>
                          )}
                        </>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={(e) => e.target.checked && handleDiscrepancyCheck(row.id, true)}
                            className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                          />
                        </>
                      )}
                    </div>
                  </td>
                  {canUseTestMode && !isCompletedLocked && (
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50"
                        aria-label="Delete row"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        )}
      </div>

      <DeliverySlotModal
        isOpen={deliveryModal.open}
        dateLabel={deliveryModal.dateLabel}
        onClose={() => setDeliveryModal({ open: false, rowId: null, dateLabel: '' })}
        onSelect={handleDeliverySlotSelect}
      />

      <DiscrepancyModal
        isOpen={discrepancyModal.open}
        initialTitle={discrepancyModal.title}
        initialDesc={discrepancyModal.description}
        onClose={() => {
          if (discrepancyModal.rowId) handleDiscrepancyCancel(discrepancyModal.rowId)
          setDiscrepancyModal({ open: false, rowId: null, title: '', description: '' })
        }}
        onSave={({ title, description }) =>
          discrepancyModal.rowId &&
          handleDiscrepancySave(discrepancyModal.rowId, { title, description })
        }
        onRemove={
          discrepancyModal.rowId
            ? () => handleDiscrepancyCancel(discrepancyModal.rowId)
            : undefined
        }
      />

      <SelectSalesmanModal
        isOpen={salesmanModal.open}
        rowId={salesmanModal.rowId}
        previousStatus={salesmanModal.previousStatus}
        onClose={() =>
          salesmanModal.rowId != null
            ? handleSalesmanModalCancel(salesmanModal.rowId, salesmanModal.previousStatus)
            : setSalesmanModal({ open: false, rowId: null, previousStatus: '' })
        }
        onSelect={handleSalesmanSelect}
      />

      <SelectClerkModal
        isOpen={clerkModal.open}
        rowId={clerkModal.rowId}
        previousStatus={clerkModal.previousStatus}
        onClose={() =>
          clerkModal.rowId != null
            ? handleClerkModalCancel(clerkModal.rowId, clerkModal.previousStatus)
            : setClerkModal({ open: false, rowId: null, previousStatus: '' })
        }
        onSelect={handleClerkSelect}
      />

      <SelectWarehouseModal
        isOpen={warehouseModal.open}
        rowId={warehouseModal.rowId}
        previousStatus={warehouseModal.previousStatus}
        onClose={() =>
          warehouseModal.rowId != null
            ? handleWarehouseModalCancel(warehouseModal.rowId, warehouseModal.previousStatus)
            : setWarehouseModal({ open: false, rowId: null, previousStatus: '' })
        }
        onSelect={handleWarehouseSelect}
      />

      <SelectWarehouseModal
        isOpen={holdWarehouseModal.open}
        rowId={holdWarehouseModal.rowId}
        previousStatus={holdWarehouseModal.previousStatus}
        onClose={handleHoldWarehouseModalCancel}
        onSelect={handleHoldWarehouseSelect}
      />

      <SelectWarehouseModal
        isOpen={chopSignNoWarehouseModal.open}
        rowId={chopSignNoWarehouseModal.rowId}
        previousStatus={chopSignNoWarehouseModal.previousStatus}
        onClose={handleChopSignNoWarehouseCancel}
        onSelect={handleChopSignNoWarehouseSelect}
      />

      <HoldWarehouseTypeModal
        isOpen={holdWarehouseTypeModal.open}
        warehouseName={holdWarehouseTypeModal.warehouseName}
        onClose={handleHoldWarehouseTypeCancel}
        onSelect={handleHoldWarehouseTypeSelect}
      />

      {preparingDeliveryTypeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handlePreparingDeliveryTypeCancel}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Assign to</h3>
            <p className="text-slate-600 text-sm mb-4">Select Salesman or Driver</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePreparingDeliveryTypeSelect('Salesman')}
                className="flex-1 py-2.5 px-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium"
              >
                Salesman
              </button>
              <button
                type="button"
                onClick={() => handlePreparingDeliveryTypeSelect('Driver')}
                className="flex-1 py-2.5 px-4 bg-slate-600 text-white rounded-lg hover:bg-slate-500 font-medium"
              >
                Driver
              </button>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={handlePreparingDeliveryTypeCancel}
                className="w-full px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <SelectDriverModal
        isOpen={driverModal.open}
        rowId={driverModal.rowId}
        previousStatus={driverModal.previousStatus}
        onClose={() =>
          driverModal.rowId != null
            ? handleDriverModalCancel(driverModal.rowId, driverModal.previousStatus)
            : setDriverModal({ open: false, rowId: null, previousStatus: '' })
        }
        onSelect={handleDriverSelect}
      />

      <NoticeModal
        isOpen={deliveredNoticeOpen}
        message={DELIVERED_VALIDATION_MSG}
        onClose={() => setDeliveredNoticeOpen(false)}
      />

      <NoticeModal
        isOpen={deliveryInProgressNoticeOpen}
        message={DELIVERY_IN_PROGRESS_VALIDATION_MSG}
        onClose={() => setDeliveryInProgressNoticeOpen(false)}
      />

      <NoticeModal
        isOpen={phase4LockedNoticeOpen}
        message={PHASE_4_LOCKED_MSG}
        onClose={() => setPhase4LockedNoticeOpen(false)}
      />

      {sameStatusConfirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleSameStatusConfirmClose}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Same status selected</h3>
            <p className="text-slate-600 text-sm mb-4">
              Same status has been selected. Do you want to start over?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleSameStatusConfirmClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleSameStatusStartOver}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Yes, start over
              </button>
            </div>
          </div>
        </div>
      )}

      {completedConfirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleCompletedConfirmNo}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Confirm Completed</h3>
            <p className="text-slate-600 text-sm mb-4">
              Once confirmed, order will be locked and no further changes can be made.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCompletedConfirmNo}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleCompletedConfirmYes}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelledConfirmModal.open && (() => {
        const row = invoices.find((r) => r.id === cancelledConfirmModal.rowId)
        const serial = row?.invoiceNo || cancelledConfirmModal.rowId || 'this document'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleCancelledConfirmNo}>
            <div
              className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Confirm cancellation</h3>
              <p className="text-slate-600 text-sm mb-4">
                Confirm cancellation of <strong>{serial}</strong>? Once cancelled, this document can no longer be edited.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCancelledConfirmNo}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={handleCancelledConfirmYes}
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
                >
                  Yes, cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {rearrangeDeliveryConfirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleRearrangeDeliveryNo}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Redeliver order?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Are you trying to redeliver this order?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleRearrangeDeliveryNo}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleRearrangeDeliveryYes}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {chopSignWarehouseConfirmModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleChopSignWarehouseNo()
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Chop & Sign - Warehouse</h3>
            <p className="text-slate-600 text-sm mb-4">
              Does the driver bring this for chop and sign?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleChopSignWarehouseNo()
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleChopSignWarehouseYes()
                }}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {backtrackPhase2To1Modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleBacktrackPhase2To1No}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Backtrack progress?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Are you sure you want to backtrack the progress? All progress in current status will be reset.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleBacktrackPhase2To1No}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleBacktrackPhase2To1Yes}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {backtrackPhase3To1Modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleBacktrackPhase3To1No}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Backtrack progress?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Are you sure you want to backtrack the progress? All progress in current status will be reset.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleBacktrackPhase3To1No}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleBacktrackPhase3To1Yes}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {phase4BacktrackModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handlePhase4BacktrackNo}>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Backtrack progress?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Are you sure you wanna backtrack the progress? Everything will be reset.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={handlePhase4BacktrackNo} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">No</button>
              <button type="button" onClick={handlePhase4BacktrackYes} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">Yes</button>
            </div>
          </div>
        </div>
      )}

      {phase3ToOtherPhase2Modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handlePhase3ToOtherPhase2No}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Change status?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Are you sure you want to change to this status? All progress in current status will be reset.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handlePhase3ToOtherPhase2No}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handlePhase3ToOtherPhase2Yes}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkApplyConfirmModal.open && bulkApplyConfirmModal.rowIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleBulkApplyNo}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Apply to selected invoices?</h3>
            <p className="text-slate-600 text-sm mb-2">
              Are you sure you want to apply this to the following?
            </p>
            <ul className="text-slate-700 text-sm mb-4 max-h-40 overflow-y-auto list-disc list-inside">
              {bulkApplyConfirmModal.rowIds.map((id) => {
                const inv = invoices.find((r) => r.id === id)
                return (
                  <li key={id}>{inv?.invoiceNo || id}</li>
                )
              })}
            </ul>
            <p className="text-slate-600 text-sm mb-4">If yes, proceed to apply. If no, nothing changes.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleBulkApplyNo}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleBulkApplyYes}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {assignDateModal.open && createPortal(
        <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
          {/* Backdrop: only this div closes on outside click */}
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={(e) => {
              if (e.target === e.currentTarget) handleAssignDateCancel()
            }}
          />
          {/* Modal card: in front of backdrop, receives all clicks inside it */}
          <div className="absolute inset-0 flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
            <div
              className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative"
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="assign-date-title" className="text-lg font-semibold text-slate-800 mb-3">Select date</h3>
              <input
                type="date"
                value={assignDateModal.selectedDate ? toInputDate(assignDateModal.selectedDate) : toInputDate(getTodayDateStr())}
                onChange={(e) =>
                  setAssignDateModal((prev) => ({ ...prev, selectedDate: e.target.value || getTodayDateStr() }))
                }
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAssignDateConfirm(); } }}
                className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 mb-4"
                aria-label="Choose date"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleAssignDateCancel}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleAssignDateConfirm()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleAssignDateConfirm()
                  }}
                  className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 cursor-pointer font-medium"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
