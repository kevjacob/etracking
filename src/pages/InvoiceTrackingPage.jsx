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
import { fetchGRNs, updateGRN } from '../api/grn'
import { fetchDeliveryOrders, updateDeliveryOrder } from '../api/deliveryOrders'
import LinkedTrackingRemark from '../components/LinkedTrackingRemark'
import DeliverySlotModal from '../components/DeliverySlotModal'
import AdditionalRemarkModal from '../components/AdditionalRemarkModal'
import AdditionalRemarkCell from '../components/AdditionalRemarkCell'
import SelectSalesmanModal from '../components/SelectSalesmanModal'
import SelectClerkModal from '../components/SelectClerkModal'
import SelectWarehouseModal from '../components/SelectWarehouseModal'
import HoldWarehouseTypeModal from '../components/HoldWarehouseTypeModal'
import RemoveSelfCollectModal from '../components/RemoveSelfCollectModal'
import SelectDriverModal from '../components/SelectDriverModal'
import AssignedToCell from '../components/AssignedToCell'
import ReassignAssigneeModal, { reassignAssigneeUpdates } from '../components/ReassignAssigneeModal'
import ReassignAssignedDateModal, { reassignDateUpdates } from '../components/ReassignAssignedDateModal'
import NoticeModal from '../components/NoticeModal'
import RefreshListButton from '../components/RefreshListButton'
import TrackingMonthFilter from '../components/TrackingMonthFilter'
import TrackingPagination from '../components/TrackingPagination'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { useTrackingListView } from '../hooks/useTrackingListView'
import { formatMonthLabel } from '../utils/trackingListFilters'
import { appendChopSignToRemark, hasSelfCollectInRemark, leavingChopSignRemarkPayload } from '../utils/remarkUtils'
import { isStatusOverdue } from '../utils/alertStatus'
import { recordStatusTransition, recordInitialStatus } from '../utils/recordStatusTransition'
import { useAlertSettings } from '../context/AlertSettingsContext'

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
const STATUS_SHOWS_DELIVERY_ASSIGNEE = ['Delivery In Progress', 'Delivered', 'Completed']

function getPhase(status) {
  if (PHASE_1.includes(status)) return 1
  if (PHASE_2.includes(status)) return 2
  if (PHASE_3.includes(status)) return 3
  if (PHASE_4.includes(status)) return 4
  if (PHASE_5.includes(status)) return 5
  return 1
}

const DELIVERED_VALIDATION_MSG = 'Assigned person and date is missing, please go to preparing delivery.'
const DELIVERY_IN_PROGRESS_VALIDATION_MSG = 'Driver and Delivery date yet to be assigned.'
const PHASE_4_LOCKED_MSG = 'This Status can no longer be changed as the order has been completed.'

import {
  getAutocountInvoiceNo,
  buildAutocountAdditionalRemark,
  getAddInvoiceFormTitle,
  IV_PREFIX,
  T_PREFIX,
  IV_DIGIT_LEN,
  T_DIGIT_LEN,
} from '../utils/autocountInvoiceUtils'
import { normalizeDigits, buildDocNoLookup } from '../utils/grcGrnSync'
import {
  buildDocUpdateForInvoiceLink,
  hasLinkedDocInInvoiceRemark,
  resolveLinkedDoFromInvoice,
  resolveLinkedGrnFromInvoice,
} from '../utils/invoiceLinkSync'
import { defaultAdditionalRemark, getAdditionalRemarkText, saveAdditionalRemark } from '../utils/additionalRemark'

function emptyAddInvoiceRow() {
  return { invoiceNo: '', digits: '', dateOfInvoice: '', additionalRemark: '' }
}

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
    discrepancy: defaultAdditionalRemark(),
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
  const statusHistoryEntityType = useAutocountStorage ? 'autocount_invoice' : 'esd_invoice'
  const { isSuperuser } = useAuth()
  const { settings: alertSettings } = useAlertSettings()
  const { testMode } = useTestMode()
  const { employees } = useEmployees()
  const { warehouses } = useWarehouses()
  const drivers = employees.filter((e) => e.position === 'Lorry Driver')
  const salesmen = employees.filter((e) => e.position === 'Salesman')
  const canUseTestMode = testMode && isSuperuser
  const [invoices, setInvoices] = useState([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [linkedGrns, setLinkedGrns] = useState([])
  const [linkedDeliveryOrders, setLinkedDeliveryOrders] = useState([])
  const [deliveryModal, setDeliveryModal] = useState({ open: false, rowId: null, dateLabel: '' })
  const [additionalRemarkModal, setAdditionalRemarkModal] = useState({
    open: false,
    rowId: null,
    remark: '',
  })
  const [datePickerRow, setDatePickerRow] = useState(null)
  const [invoiceDatePickerRow, setInvoiceDatePickerRow] = useState(null)
  const [salesmanModal, setSalesmanModal] = useState({ open: false, rowId: null, previousStatus: '' })
  const [reassignModal, setReassignModal] = useState({ open: false, rowId: null, currentName: '' })
  const [reassignDateModal, setReassignDateModal] = useState({
    open: false,
    rowId: null,
    currentLabel: '',
    initialDate: '',
    initialSlot: '',
  })
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
  const [removeSelfCollectModal, setRemoveSelfCollectModal] = useState({
    open: false,
    pending: null,
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
  const [addInvoiceFormOpen, setAddInvoiceFormOpen] = useState(false)
  const [addInvoiceKind, setAddInvoiceKind] = useState('iv')
  const [addInvoiceMultiple, setAddInvoiceMultiple] = useState(false)
  const [addInvoiceRows, setAddInvoiceRows] = useState([emptyAddInvoiceRow()])
  const [addInvoiceApplyDateToAll, setAddInvoiceApplyDateToAll] = useState(false)
  const [addInvoiceConfirmOpen, setAddInvoiceConfirmOpen] = useState(false)
  const [addInvoiceConfirmSaving, setAddInvoiceConfirmSaving] = useState(false)
  const [addInvoiceConfirmError, setAddInvoiceConfirmError] = useState('')
  const [overwriteInvoiceModal, setOverwriteInvoiceModal] = useState({
    open: false,
    conflicts: [],
    nonConflicting: [],
    index: 0,
  })
  const trackingPageKey = useAutocountStorage ? 'autocount-invoices' : 'esd-invoices'
  const getInvoiceDate = useCallback((row) => row.dateOfInvoice, [])
  const getInvoiceSearch = useCallback((row) => row.invoiceNo, [])
  const sortInvoices = useCallback((list) => sortBySerial(list, (row) => row.invoiceNo), [])
  const {
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    filteredRows: filteredInvoices,
    pageRows: pagedInvoices,
    currentPage,
    totalPages,
    totalItems: filteredInvoiceCount,
    goToPage,
  } = useTrackingListView({
    pageKey: trackingPageKey,
    rows: invoices,
    searchQuery: invoiceSearchQuery,
    getDateField: getInvoiceDate,
    getSearchField: getInvoiceSearch,
    sortRows: sortInvoices,
  })
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

  useEffect(() => {
    fetchGRNs()
      .then((list) => setLinkedGrns(Array.isArray(list) ? list : []))
      .catch((e) => {
        console.error('Fetch GRNs for invoice link error:', e)
        setLinkedGrns([])
      })
    fetchDeliveryOrders()
      .then((list) => setLinkedDeliveryOrders(Array.isArray(list) ? list : []))
      .catch((e) => {
        console.error('Fetch delivery orders for invoice link error:', e)
        setLinkedDeliveryOrders([])
      })
  }, [])

  useRealtimeTable(useAutocountStorage ? 'invoices_autocount' : 'invoices', setInvoices)

  const grnLookup = useMemo(() => buildDocNoLookup(linkedGrns, 'grnNo'), [linkedGrns])
  const doLookup = useMemo(
    () => buildDocNoLookup(linkedDeliveryOrders, 'deliveryOrderNo'),
    [linkedDeliveryOrders]
  )
  const syncGuardRef = useRef(false)

  const syncInvoiceToLinkedDoc = useCallback(
    async (invoiceRow) => {
      if (syncGuardRef.current) return
      const grnRow = resolveLinkedGrnFromInvoice(invoiceRow, linkedGrns)
      const doRow = grnRow ? null : resolveLinkedDoFromInvoice(invoiceRow, linkedDeliveryOrders)
      const linked = grnRow || doRow
      if (!linked) return
      syncGuardRef.current = true
      try {
        const payload = buildDocUpdateForInvoiceLink(linked, invoiceRow, invoiceRow.invoiceNo)
        if (grnRow) {
          const updated = await updateGRN(grnRow.id, payload)
          if (updated) setLinkedGrns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        } else {
          const updated = await updateDeliveryOrder(doRow.id, payload)
          if (updated) {
            setLinkedDeliveryOrders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
          }
        }
      } catch (e) {
        console.error('Sync invoice to linked GRN/DO error:', e)
      } finally {
        syncGuardRef.current = false
      }
    },
    [linkedGrns, linkedDeliveryOrders]
  )

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
      const prevRow = prev.find((r) => r.id === id)
      if (updates.status !== undefined && prevRow && updates.status !== prevRow.status) {
        recordStatusTransition(prevRow, updates.status, {
          entityType: statusHistoryEntityType,
          getDocumentNo: (r) => r.invoiceNo,
        })
      }
      const next = prev.map((row) => (row.id === id ? { ...row, ...withTimestamp } : row))
      const row = next.find((r) => r.id === id)
      if (!row) return next
      updateInvoice(id, row)
        .then((updated) => {
          if (updated) {
            setInvoices((p) => p.map((r) => (r.id === id ? updated : r)))
            if (hasLinkedDocInInvoiceRemark(updated)) syncInvoiceToLinkedDoc(updated)
          }
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

  const closeAdditionalRemarkModal = () => {
    setAdditionalRemarkModal({ open: false, rowId: null, remark: '' })
  }

  const handleAdditionalRemarkOpen = (rowId) => {
    const row = invoices.find((r) => r.id === rowId)
    setAdditionalRemarkModal({
      open: true,
      rowId,
      remark: getAdditionalRemarkText(row?.discrepancy),
    })
  }

  const handleAdditionalRemarkSave = (rowId, remark) => {
    updateRow(rowId, { discrepancy: saveAdditionalRemark(remark) })
    closeAdditionalRemarkModal()
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
    const chopSignRemarkUpdate = leavingChopSignRemarkPayload(row.status, newStatus, row.remark)
    if (newStatus === 'Delivery In Progress') {
      updateRow(rowId, {
        status: newStatus,
        assignedSalesmanId: null,
        assignedDriverId: null,
        ...remarkAtBilledUpdate,
        ...chopSignRemarkUpdate,
      })
      setPreparingDeliveryTypeModal({ open: true, rowId, previousStatus })
    } else if (STATUS_REQUIRES_SALESMAN.includes(newStatus)) {
      updateRow(rowId, { status: newStatus, assignedDriverId: null, ...remarkAtBilledUpdate, ...chopSignRemarkUpdate })
      setSalesmanModal({ open: true, rowId, previousStatus })
    } else if (STATUS_REQUIRES_CLERK.includes(newStatus)) {
      updateRow(rowId, { status: newStatus, assignedDriverId: null, ...remarkAtBilledUpdate, ...chopSignRemarkUpdate })
      setClerkModal({ open: true, rowId, previousStatus })
    } else if (newStatus === STATUS_TRANSFER) {
      updateRow(rowId, { status: newStatus, ...remarkAtBilledUpdate, ...chopSignRemarkUpdate })
      setWarehouseModal({ open: true, rowId, previousStatus })
    } else if (newStatus === 'Hold - Warehouse') {
      updateRow(rowId, { status: newStatus, assignedDriverId: null, ...remarkAtBilledUpdate, ...chopSignRemarkUpdate })
      setHoldWarehouseModal({ open: true, rowId, previousStatus })
    } else if (newStatus === 'Chop & Sign - Warehouse') {
      setChopSignWarehouseConfirmModal({ open: true, rowId, previousStatus })
      return
    } else if (newStatus === 'Delivered') {
      const payload = { status: newStatus, ...remarkAtBilledUpdate, ...chopSignRemarkUpdate }
      updateRow(rowId, payload)
      afterBulkableCommit(rowId, payload, () => {})
    } else {
      const payload = {
        status: newStatus,
        assignedSalesmanId: null,
        assignedClerkId: null,
        transferWarehouseId: null,
        ...(clearDriverForHoldOrChop ? { assignedDriverId: null } : {}),
        ...remarkAtBilledUpdate,
        ...chopSignRemarkUpdate,
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
    assignDatePendingRef.current = { rowId, fromDriver: false, clerkId }
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
    setHoldWarehouseTypeModal({ open: false, rowId: null, warehouseId: null, warehouseName: '', previousStatus: '' })
    afterBulkableCommit(rowId, payload, () => {})
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
    const row = invoices.find((r) => r.id === rowId)
    const payload = {
      status: newStatus,
      ...resetPhase3Fields,
      ...leavingChopSignRemarkPayload(previousStatus, newStatus, row?.remark),
    }
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
    const row = invoices.find((r) => r.id === rowId)
    const payload = {
      status: 'Completed',
      ...leavingChopSignRemarkPayload(row?.status, 'Completed', row?.remark),
    }
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

  const applyChopSignRemarkUpdate = (pending, removeSelfCollect) => {
    const { rowIdToUse, dateToSave, fromChopSignNoFlow, fromChopSignWarehouse } = pending
    const row = invoices.find((r) => r.id === rowIdToUse)
    const newRemark = appendChopSignToRemark(row?.remark, { removeSelfCollect })
    if (fromChopSignNoFlow) {
      const { warehouseId } = fromChopSignNoFlow
      const payload = {
        status: 'Hold - Warehouse',
        holdWarehouseId: warehouseId,
        holdWarehouseType: removeSelfCollect ? '' : row?.holdWarehouseType ?? '',
        assignedDriverId: null,
        deliveryDate: dateToSave,
        deliverySlot: '',
        remark: newRemark,
      }
      updateRow(rowIdToUse, payload)
      afterBulkableCommit(rowIdToUse, payload, () => {})
    } else if (fromChopSignWarehouse) {
      const payload = {
        status: 'Delivery In Progress',
        deliveryDate: dateToSave,
        deliverySlot: '',
        remark: newRemark,
        ...(removeSelfCollect ? { holdWarehouseType: '' } : {}),
      }
      updateRow(rowIdToUse, payload)
      afterBulkableCommit(rowIdToUse, payload, () => {})
    }
  }

  const handleRemoveSelfCollectYes = () => {
    const { pending } = removeSelfCollectModal
    if (pending) applyChopSignRemarkUpdate(pending, true)
    setRemoveSelfCollectModal({ open: false, pending: null })
  }

  const handleRemoveSelfCollectNo = () => {
    const { pending } = removeSelfCollectModal
    if (pending) applyChopSignRemarkUpdate(pending, false)
    setRemoveSelfCollectModal({ open: false, pending: null })
  }

  const handleAssignDateConfirm = () => {
    const ref = assignDatePendingRef.current
    const { rowId: refRowId, fromDriver, fromChopSignWarehouse, fromChopSignNoFlow, clerkId } = ref
    const rowIdToUse = refRowId ?? assignDateModal.rowId
    const dateStr = assignDateModal.selectedDate || getTodayDateStr()
    const parsed = parseDate(dateStr)
    const dateToSave = parsed || getTodayDateStr()

    if (rowIdToUse && (fromChopSignNoFlow || fromChopSignWarehouse)) {
      const row = invoices.find((r) => r.id === rowIdToUse)
      if (hasSelfCollectInRemark(row?.remark)) {
        setRemoveSelfCollectModal({
          open: true,
          pending: { rowIdToUse, dateToSave, fromChopSignNoFlow, fromChopSignWarehouse },
        })
        assignDatePendingRef.current = {
          rowId: null,
          fromDriver: false,
          fromChopSignWarehouse: false,
          fromChopSignNoFlow: null,
        }
        setAssignDateModal({ open: false, rowId: null, selectedDate: '', fromDriver: false })
        return
      }
    }

    assignDatePendingRef.current = {
      rowId: null,
      fromDriver: false,
      fromChopSignWarehouse: false,
      fromChopSignNoFlow: null,
    }
    setAssignDateModal({ open: false, rowId: null, selectedDate: '', fromDriver: false })

    try {
      if (rowIdToUse) {
        if (fromChopSignNoFlow || fromChopSignWarehouse) {
          applyChopSignRemarkUpdate(
            { rowIdToUse, dateToSave, fromChopSignNoFlow, fromChopSignWarehouse },
            false
          )
          return
        }
        updateRow(rowIdToUse, { deliveryDate: dateToSave, deliverySlot: '' })
        if (fromDriver) {
          setDeliveryModal({ open: true, rowId: rowIdToUse, dateLabel: formatDate(dateToSave) })
        } else {
          const leadRow = invoices.find((r) => r.id === rowIdToUse)
          const assignedClerkId = clerkId ?? leadRow?.assignedClerkId ?? null
          const payload = leadRow
            ? {
                status: leadRow.status,
                assignedSalesmanId: leadRow.assignedSalesmanId,
                assignedClerkId,
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

  const handleAddInvoiceApplyDateToAllChange = (checked) => {
    setAddInvoiceApplyDateToAll(checked)
    if (checked) {
      const firstDate = addInvoiceRows[0]?.dateOfInvoice || ''
      setAddInvoiceRows((prev) => prev.map((r) => ({ ...r, dateOfInvoice: firstDate })))
    }
  }

  const handleAddInvoiceMultipleToggle = (on) => {
    setAddInvoiceMultiple(on)
    if (on) {
      setAddInvoiceRows(Array(10).fill(null).map(() => emptyAddInvoiceRow()))
      setAddInvoiceApplyDateToAll(false)
    } else {
      const first = addInvoiceRows[0] ? { ...addInvoiceRows[0] } : emptyAddInvoiceRow()
      setAddInvoiceRows([first])
      setAddInvoiceApplyDateToAll(false)
    }
  }

  const setAddInvoiceRow = (index, field, value) => {
    setAddInvoiceRows((prev) => {
      let nextValue = value
      if (field === 'digits') {
        const maxLen = useAutocountStorage && addInvoiceKind === 'iv' ? IV_DIGIT_LEN : T_DIGIT_LEN
        nextValue = normalizeDigits(value, maxLen)
      }
      const next = prev.map((r, i) => (i === index ? { ...r, [field]: nextValue } : r))
      if (addInvoiceApplyDateToAll && field === 'dateOfInvoice' && index === 0) {
        return next.map((r, i) => (i === 0 ? r : { ...r, dateOfInvoice: nextValue }))
      }
      return next
    })
  }

  const getAddInvoiceEntries = () => {
    const firstDate = addInvoiceApplyDateToAll ? (addInvoiceRows[0]?.dateOfInvoice || '') : null
    return addInvoiceRows
      .map((r) => {
        const invoiceNo = useAutocountStorage
          ? getAutocountInvoiceNo(addInvoiceKind, r.digits) || ''
          : (r.invoiceNo || '').trim()
        if (!invoiceNo) return null
        return {
          invoiceNo,
          dateOfInvoice: addInvoiceApplyDateToAll ? firstDate : (r.dateOfInvoice || ''),
          additionalRemark: (r.additionalRemark || '').trim(),
        }
      })
      .filter(Boolean)
  }

  const handleAddInvoiceProceed = () => {
    const rowsWithData = useAutocountStorage
      ? addInvoiceRows.filter((r) => normalizeDigits(r.digits, addInvoiceKind === 'iv' ? IV_DIGIT_LEN : T_DIGIT_LEN).length > 0)
      : addInvoiceRows.filter((r) => (r.invoiceNo || '').trim())
    if (rowsWithData.length === 0) return
    if (useAutocountStorage) {
      for (const r of rowsWithData) {
        if (!getAutocountInvoiceNo(addInvoiceKind, r.digits)) return
      }
    }
    const entries = getAddInvoiceEntries()
    if (entries.length === 0) return
    if (addInvoiceApplyDateToAll && !addInvoiceRows[0]?.dateOfInvoice) return
    for (const e of entries) {
      if (!addInvoiceApplyDateToAll && !e.dateOfInvoice) return
    }
    setAddInvoiceConfirmError('')
    setAddInvoiceConfirmOpen(true)
  }

  const openAddInvoiceForm = (kind = 'iv') => {
    setAddInvoiceKind(kind)
    setAddInvoiceFormOpen(true)
    setAddInvoiceConfirmOpen(false)
    setAddInvoiceRows(
      addInvoiceMultiple ? Array(10).fill(null).map(() => emptyAddInvoiceRow()) : [emptyAddInvoiceRow()]
    )
    setAddInvoiceApplyDateToAll(false)
  }

  const getInvoiceRowDisplay = (row) => {
    const clerk = row.assignedClerkId ? employees.find((e) => e.id === row.assignedClerkId) : null
    const salesman = row.assignedSalesmanId ? salesmen.find((s) => s.id === row.assignedSalesmanId) : null
    const driver = row.assignedDriverId ? drivers.find((d) => d.id === row.assignedDriverId) : null
    const transferWarehouse = row.transferWarehouseId ? warehouses.find((w) => w.id === row.transferWarehouseId) : null
    const holdWarehouse = row.holdWarehouseId ? warehouses.find((w) => w.id === row.holdWarehouseId) : null
    const assignedTo =
      row.status === 'Preparing Delivery' || row.status === 'Billed'
        ? 'Unassigned'
        : row.status === STATUS_TRANSFER && transferWarehouse
          ? transferWarehouse.name
          : row.status === 'Hold - Warehouse' && holdWarehouse
            ? holdWarehouse.name || 'Unassigned'
            : STATUS_REQUIRES_CLERK.includes(row.status)
              ? clerk?.name ?? 'Unassigned'
              : STATUS_REQUIRES_SALESMAN.includes(row.status)
                ? salesman?.name ?? 'Unassigned'
                : row.status === 'Delivery In Progress' || row.status === 'Delivered' || row.status === 'Completed'
                  ? salesman?.name ?? driver?.name ?? 'Unassigned'
                  : driver?.name ?? 'Unassigned'
    const assignedDate =
      row.deliveryDate && row.deliverySlot
        ? `${formatDate(row.deliveryDate)} - ${row.deliverySlot}`
        : row.deliveryDate
          ? formatDate(row.deliveryDate)
          : '–'
    return { status: row.status, assignedTo, assignedDate }
  }

  const formatAddInvoiceError = (err) => {
    const msg = err?.message || String(err)
    if (/row-level security|permission denied|42501/i.test(msg)) {
      return 'Could not save invoice: the database blocked this action. If using online Supabase, run supabase/remote-policies-backup.sql in the SQL Editor.'
    }
    return msg || 'Could not save invoice.'
  }

  const insertNewInvoiceEntries = async (entries) => {
    const insertedRows = []
    for (const e of entries) {
      const discrepancy = useAutocountStorage
        ? buildAutocountAdditionalRemark(addInvoiceKind, e.additionalRemark)
        : saveAdditionalRemark(e.additionalRemark)
      const newRow = createInvoice({
        invoiceNo: e.invoiceNo,
        dateOfInvoice: e.dateOfInvoice,
        discrepancy,
      })
      const inserted = await insertInvoice(newRow)
      recordInitialStatus({
        entityType: statusHistoryEntityType,
        entityId: inserted.id,
        documentNo: inserted.invoiceNo,
        status: inserted.status || 'Billed',
        statusAt: inserted.statusUpdatedAt,
      })
      insertedRows.push(inserted)
    }
    if (insertedRows.length > 0) {
      setInvoices((prev) => [...prev, ...insertedRows])
    }
  }

  const closeAddInvoiceFlow = () => {
    setAddInvoiceFormOpen(false)
    setAddInvoiceConfirmOpen(false)
    setAddInvoiceConfirmError('')
    setAddInvoiceConfirmSaving(false)
    setAddInvoiceRows([emptyAddInvoiceRow()])
    setAddInvoiceApplyDateToAll(false)
  }

  const handleAddInvoiceConfirmYes = async () => {
    if (addInvoiceConfirmSaving) return
    setAddInvoiceConfirmError('')
    const entries = getAddInvoiceEntries()
    const conflicts = []
    const nonConflicting = []
    for (const e of entries) {
      const existing = invoices.find((r) => (r.invoiceNo || '').trim() === (e.invoiceNo || '').trim())
      if (existing) conflicts.push({ existingRow: existing, newEntry: e })
      else nonConflicting.push(e)
    }
    if (conflicts.length > 0) {
      setAddInvoiceConfirmOpen(false)
      setAddInvoiceConfirmError('')
      setOverwriteInvoiceModal({ open: true, conflicts, nonConflicting, index: 0 })
      return
    }
    setAddInvoiceConfirmSaving(true)
    try {
      await insertNewInvoiceEntries(nonConflicting)
      closeAddInvoiceFlow()
    } catch (err) {
      console.error('Failed to add invoice(s):', err)
      setAddInvoiceConfirmError(formatAddInvoiceError(err))
    } finally {
      setAddInvoiceConfirmSaving(false)
    }
  }

  const handleOverwriteInvoiceYes = async () => {
    const { conflicts, nonConflicting, index } = overwriteInvoiceModal
    const { existingRow, newEntry } = conflicts[index]
    const resetPayload = {
      invoiceNo: newEntry.invoiceNo,
      dateOfInvoice: newEntry.dateOfInvoice,
      status: 'Billed',
      assignedDriverId: null,
      assignedSalesmanId: null,
      assignedClerkId: null,
      deliveryDate: '',
      deliverySlot: '',
      transferWarehouseId: null,
      holdWarehouseId: null,
      holdWarehouseType: '',
    }
    try {
      await updateInvoice(existingRow.id, resetPayload)
      setInvoices((prev) =>
        prev.map((r) => (r.id === existingRow.id ? { ...r, ...resetPayload } : r))
      )
      if (index + 1 < conflicts.length) {
        setOverwriteInvoiceModal((prev) => ({ ...prev, index: prev.index + 1 }))
      } else {
        await insertNewInvoiceEntries(nonConflicting)
        setOverwriteInvoiceModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
        closeAddInvoiceFlow()
      }
    } catch (err) {
      console.error('Failed to overwrite invoice:', err)
      setAddInvoiceConfirmError(formatAddInvoiceError(err))
      setOverwriteInvoiceModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
      setAddInvoiceConfirmOpen(true)
    }
  }

  const handleOverwriteInvoiceNo = async () => {
    const { conflicts, nonConflicting, index } = overwriteInvoiceModal
    if (index + 1 < conflicts.length) {
      setOverwriteInvoiceModal((prev) => ({ ...prev, index: prev.index + 1 }))
      return
    }
    try {
      await insertNewInvoiceEntries(nonConflicting)
      setOverwriteInvoiceModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
      closeAddInvoiceFlow()
    } catch (err) {
      console.error('Failed to add invoice(s):', err)
      setAddInvoiceConfirmError(formatAddInvoiceError(err))
      setOverwriteInvoiceModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
      setAddInvoiceConfirmOpen(true)
    }
  }

  const handleAddInvoiceConfirmNo = () => {
    setAddInvoiceConfirmOpen(false)
    setAddInvoiceConfirmError('')
  }

  const handleAddInvoiceFormClose = () => {
    setOverwriteInvoiceModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
    closeAddInvoiceFlow()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2">
        {pageTitle}
      </h1>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
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
          <TrackingMonthFilter
            id="invoice-month-filter"
            availableMonths={availableMonths}
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <RefreshListButton onRefresh={loadInvoices} loading={invoicesLoading} label="Refresh invoice list" />
          {useAutocountStorage ? (
            <>
              <button type="button" onClick={() => openAddInvoiceForm('iv')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">
                <Plus size={18} /> Add IV Invoice
              </button>
              <button type="button" onClick={() => openAddInvoiceForm('fn-t')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">
                <Plus size={18} /> Add F&N T Invoice
              </button>
              <button type="button" onClick={() => openAddInvoiceForm('heineken-t')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">
                <Plus size={18} /> Add Heineken T Invoice
              </button>
            </>
          ) : (
            <button type="button" onClick={() => openAddInvoiceForm('iv')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">
              <Plus size={18} /> Add New Invoice
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
        {invoicesLoading ? (
          <div className="p-8 text-center text-slate-500">Loading invoices…</div>
        ) : filteredInvoiceCount === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {invoiceSearchQuery.trim()
              ? 'No invoices match your search.'
              : selectedMonth
                ? `No invoices for ${formatMonthLabel(selectedMonth)}.`
                : useAutocountStorage
                  ? 'No invoices added yet. Click "Add IV Invoice" to add one.'
                  : 'No invoices added yet. Click "Add New Invoice" to add one.'}
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
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Additional Remark</th>
              {canUseTestMode && <th className="text-left py-3 px-4 font-semibold text-slate-700 w-14">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {pagedInvoices.map((row) => {
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
                (STATUS_SHOWS_DELIVERY_ASSIGNEE.includes(row.status) && (salesman || assignedDriver))
              const assignedPersonName = STATUS_REQUIRES_CLERK.includes(row.status)
                ? (clerk?.name ?? '')
                : STATUS_REQUIRES_SALESMAN.includes(row.status)
                  ? (salesman?.name ?? '')
                  : STATUS_SHOWS_DELIVERY_ASSIGNEE.includes(row.status)
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
              const canReassignAssignee =
                !isCompletedLocked &&
                assignedToDisplay !== 'Unassigned' &&
                (assignedToDisplay === salesman?.name || assignedToDisplay === assignedDriver?.name)
              const assignedDateDisplay =
                row.deliveryDate && row.deliverySlot
                  ? `${formatDate(row.deliveryDate)} - ${row.deliverySlot}`
                  : row.deliveryDate
                    ? formatDate(row.deliveryDate)
                    : '–'
              const canReassignDate = !isCompletedLocked && assignedDateDisplay !== '–' && !!row.deliveryDate
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
                  <td className="py-2 px-4 w-12 text-center" title={isStatusOverdue(row, alertSettings) ? `Status "${row.status}" has exceeded the allowed duration (Phase ${getPhase(row.status)})` : ''}>
                    {isStatusOverdue(row, alertSettings) ? (
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
                    <AssignedToCell
                      name={assignedToDisplay}
                      showReassign={canReassignAssignee}
                      onReassign={() =>
                        setReassignModal({
                          open: true,
                          rowId: row.id,
                          currentName: assignedToDisplay,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 px-4">
                    <AssignedToCell
                      name={assignedDateDisplay}
                      showReassign={canReassignDate}
                      reassignLabel="Reassign date"
                      onReassign={() =>
                        setReassignDateModal({
                          open: true,
                          rowId: row.id,
                          currentLabel: assignedDateDisplay,
                          initialDate: row.deliveryDate || '',
                          initialSlot: row.deliverySlot || '',
                        })
                      }
                    />
                  </td>
                  <td className="py-2 px-4">
                    {hasLinkedDocInInvoiceRemark(row) ? (
                      <LinkedTrackingRemark
                        remark={row.remark}
                        grnLookup={grnLookup}
                        doLookup={doLookup}
                        className="py-1.5 px-2 block min-w-[100px]"
                      />
                    ) : (
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
                    )}
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
                    <AdditionalRemarkCell
                      discrepancy={row.discrepancy}
                      canEdit={!isCompletedLocked}
                      onEdit={() => handleAdditionalRemarkOpen(row.id)}
                    />
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
        {!invoicesLoading && filteredInvoiceCount > 0 && (
          <TrackingPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredInvoiceCount}
            onPageChange={goToPage}
          />
        )}
      </div>

      {/* Add New Invoice - Form */}
      {addInvoiceFormOpen && !addInvoiceConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{getAddInvoiceFormTitle(addInvoiceKind, useAutocountStorage)}</h3>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={addInvoiceMultiple}
                onChange={(e) => handleAddInvoiceMultipleToggle(e.target.checked)}
                className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              />
              <span className="text-sm text-slate-700">Add In Multiple</span>
            </label>
            {!addInvoiceMultiple ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
                  {useAutocountStorage ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-600 shrink-0">
                        {addInvoiceKind === 'iv' ? IV_PREFIX : T_PREFIX}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={addInvoiceKind === 'iv' ? IV_DIGIT_LEN : T_DIGIT_LEN}
                        value={addInvoiceRows[0]?.digits || ''}
                        onChange={(e) => setAddInvoiceRow(0, 'digits', e.target.value)}
                        className="flex-1 py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 font-mono"
                        placeholder={addInvoiceKind === 'iv' ? '10 digits' : '5 digits'}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={addInvoiceRows[0]?.invoiceNo || ''}
                      onChange={(e) => setAddInvoiceRow(0, 'invoiceNo', e.target.value)}
                      className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={addInvoiceRows[0]?.dateOfInvoice || ''}
                    onChange={(e) => setAddInvoiceRow(0, 'dateOfInvoice', e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Remark</label>
                  <input
                    type="text"
                    value={addInvoiceRows[0]?.additionalRemark || ''}
                    onChange={(e) => setAddInvoiceRow(0, 'additionalRemark', e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                    placeholder="Optional"
                  />
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Invoice No</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Invoice Date</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Additional Remark</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700 w-28">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addInvoiceApplyDateToAll}
                            onChange={(e) => handleAddInvoiceApplyDateToAllChange(e.target.checked)}
                            className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                          />
                          Apply To All
                        </label>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {addInvoiceRows.map((row, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="py-2 px-3">
                          {useAutocountStorage ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold text-slate-600 shrink-0">
                                {addInvoiceKind === 'iv' ? IV_PREFIX : T_PREFIX}
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={addInvoiceKind === 'iv' ? IV_DIGIT_LEN : T_DIGIT_LEN}
                                value={row.digits}
                                onChange={(e) => setAddInvoiceRow(i, 'digits', e.target.value)}
                                className="w-full py-1.5 px-2 border border-slate-300 rounded text-sm font-mono"
                              />
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={row.invoiceNo}
                              onChange={(e) => setAddInvoiceRow(i, 'invoiceNo', e.target.value)}
                              className="w-full py-1.5 px-2 border border-slate-300 rounded text-sm"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={addInvoiceApplyDateToAll ? (addInvoiceRows[0]?.dateOfInvoice || '') : row.dateOfInvoice}
                            onChange={(e) => setAddInvoiceRow(i, 'dateOfInvoice', e.target.value)}
                            disabled={addInvoiceApplyDateToAll && i > 0}
                            className={`w-full py-1.5 px-2 border rounded text-sm ${addInvoiceApplyDateToAll && i > 0 ? 'bg-slate-100 border-slate-200' : 'border-slate-300'}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.additionalRemark || ''}
                            onChange={(e) => setAddInvoiceRow(i, 'additionalRemark', e.target.value)}
                            className="w-full py-1.5 px-2 border border-slate-300 rounded text-sm"
                            placeholder="Optional"
                          />
                        </td>
                        <td className="py-2 px-3" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={handleAddInvoiceFormClose} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleAddInvoiceProceed} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Invoice - Confirm */}
      {addInvoiceFormOpen && addInvoiceConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleAddInvoiceConfirmNo}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirm new invoices</h3>
            <p className="text-slate-600 text-sm mb-4">Please confirm the following. Is all correct?</p>
            <ul className="border border-slate-200 rounded-lg divide-y divide-slate-200 mb-6 max-h-60 overflow-y-auto">
              {getAddInvoiceEntries().map((e, i) => (
                <li key={i} className="py-2 px-3 flex justify-between text-sm">
                  <span className="font-medium text-slate-800">{e.invoiceNo}</span>
                  <span className="text-slate-600">{e.dateOfInvoice ? formatDate(e.dateOfInvoice) : '–'}</span>
                </li>
              ))}
            </ul>
            {addInvoiceConfirmError && (
              <p className="text-sm text-red-600 mb-4" role="alert">{addInvoiceConfirmError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleAddInvoiceConfirmNo} disabled={addInvoiceConfirmSaving} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">No</button>
              <button type="button" onClick={handleAddInvoiceConfirmYes} disabled={addInvoiceConfirmSaving} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
                {addInvoiceConfirmSaving ? 'Saving…' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite existing Invoice */}
      {overwriteInvoiceModal.open && overwriteInvoiceModal.conflicts[overwriteInvoiceModal.index] && (() => {
        const { existingRow, newEntry } = overwriteInvoiceModal.conflicts[overwriteInvoiceModal.index]
        const existingDisplay = getInvoiceRowDisplay(existingRow)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => handleOverwriteInvoiceNo()}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Invoice already exists</h3>
              <p className="text-slate-600 text-sm mb-4">
                <strong>{newEntry.invoiceNo}</strong> already exists. Do you want to overwrite it? Once overwrite, you may lose the progress of the existing invoice.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Existing</p>
                  <table className="text-sm w-full">
                    <tbody>
                      <tr><td className="text-slate-500 py-1 pr-2">Invoice No</td><td className="font-medium">{existingRow.invoiceNo || '–'}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Invoice Date</td><td>{existingRow.dateOfInvoice ? formatDate(existingRow.dateOfInvoice) : '–'}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Status</td><td>{existingDisplay.status}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Assigned To</td><td>{existingDisplay.assignedTo}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Assigned Date</td><td>{existingDisplay.assignedDate}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-blue-50/50">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">New</p>
                  <table className="text-sm w-full">
                    <tbody>
                      <tr><td className="text-slate-500 py-1 pr-2">Invoice No</td><td className="font-medium">{newEntry.invoiceNo || '–'}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Invoice Date</td><td>{newEntry.dateOfInvoice ? formatDate(newEntry.dateOfInvoice) : '–'}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Status</td><td>Billed</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Assigned To</td><td>–</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Assigned Date</td><td>–</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={handleOverwriteInvoiceNo} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">No</button>
                <button type="button" onClick={handleOverwriteInvoiceYes} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">Yes</button>
              </div>
            </div>
          </div>
        )
      })()}

      <DeliverySlotModal
        isOpen={deliveryModal.open}
        dateLabel={deliveryModal.dateLabel}
        onClose={() => setDeliveryModal({ open: false, rowId: null, dateLabel: '' })}
        onSelect={handleDeliverySlotSelect}
      />

      <AdditionalRemarkModal
        isOpen={additionalRemarkModal.open}
        initialRemark={additionalRemarkModal.remark}
        onClose={closeAdditionalRemarkModal}
        onSave={(remark) =>
          additionalRemarkModal.rowId &&
          handleAdditionalRemarkSave(additionalRemarkModal.rowId, remark)
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
        ownOnly
        rowId={holdWarehouseModal.rowId}
        previousStatus={holdWarehouseModal.previousStatus}
        onClose={handleHoldWarehouseModalCancel}
        onSelect={handleHoldWarehouseSelect}
      />

      <SelectWarehouseModal
        isOpen={chopSignNoWarehouseModal.open}
        ownOnly
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

      <ReassignAssigneeModal
        isOpen={reassignModal.open}
        currentName={reassignModal.currentName}
        onClose={() => setReassignModal({ open: false, rowId: null, currentName: '' })}
        onConfirm={({ type, personId }) => {
          if (reassignModal.rowId) {
            updateRow(reassignModal.rowId, reassignAssigneeUpdates(type, personId))
          }
          setReassignModal({ open: false, rowId: null, currentName: '' })
        }}
      />

      <ReassignAssignedDateModal
        isOpen={reassignDateModal.open}
        currentLabel={reassignDateModal.currentLabel}
        initialDate={reassignDateModal.initialDate}
        initialSlot={reassignDateModal.initialSlot}
        onClose={() =>
          setReassignDateModal({ open: false, rowId: null, currentLabel: '', initialDate: '', initialSlot: '' })
        }
        onConfirm={({ date, slot }) => {
          if (reassignDateModal.rowId) {
            updateRow(reassignDateModal.rowId, reassignDateUpdates(date, slot))
          }
          setReassignDateModal({ open: false, rowId: null, currentLabel: '', initialDate: '', initialSlot: '' })
        }}
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

      <RemoveSelfCollectModal
        isOpen={removeSelfCollectModal.open}
        onYes={handleRemoveSelfCollectYes}
        onNo={handleRemoveSelfCollectNo}
      />

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
