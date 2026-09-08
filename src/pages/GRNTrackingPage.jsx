import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Plus, AlertTriangle, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTestMode } from '../context/TestModeContext'
import { useEmployees } from '../context/EmployeesContext'
import { useWarehouses } from '../context/WarehousesContext'
import { formatDate, toInputDate, parseDate } from '../utils/dateFormat'
import { sortBySerial } from '../utils/serialSort'
import { fetchGRNs, insertGRN, updateGRN, deleteGRN } from '../api/grn'
import { fetchGRCs, updateGRC } from '../api/grc'
import { fetchInvoices, updateInvoice } from '../api/invoices'
import { fetchInvoices as fetchAutocountInvoices, updateInvoice as updateAutocountInvoice } from '../api/autocountInvoices'
import InvoiceAttachmentSearch from '../components/InvoiceAttachmentSearch'
import DeliveryTimeAndAttachmentModal from '../components/DeliveryTimeAndAttachmentModal'
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
import LinkedTrackingRemark from '../components/LinkedTrackingRemark'
import { buildDocNoLookup, mergeLinkedSync, resolveLinkedGrc, hasLinkedGrc, formatGrnNo, normalizeDigits, DO_DIGIT_LEN, GRN_NO_PREFIX } from '../utils/grcGrnSync'
import {
  buildCombinedInvoiceLookup,
  buildInvoiceUpdateForDocLink,
  buildRemarkWithLinkedInvoice,
  hasLinkedInvoice,
  resolveLinkedInvoice,
} from '../utils/invoiceLinkSync'

function emptyAddGrnRow() {
  return { grnDigits: '', grnDate: '', additionalRemark: '', attachmentQuery: '', attachmentInvoice: null }
}

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

import { defaultAdditionalRemark, getAdditionalRemarkText, saveAdditionalRemark } from '../utils/additionalRemark'

function createGRN(overrides = {}) {
  return {
    id: String(Date.now() + Math.random()),
    grnNo: '',
    grnDate: '',
    numberAndDateLocked: false,
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
    linkedGrcId: null,
    ...overrides,
  }
}

export default function GRNTrackingPage() {
  const { isSuperuser } = useAuth()
  const { settings: alertSettings } = useAlertSettings()
  const { testMode } = useTestMode()
  const { employees } = useEmployees()
  const { warehouses } = useWarehouses()
  const drivers = employees.filter((e) => e.position === 'Lorry Driver')
  const salesmen = employees.filter((e) => e.position === 'Salesman')
  const canUseTestMode = testMode && isSuperuser
  const [grns, setGrns] = useState([])
  const [grcs, setGrcs] = useState([])
  const [esdInvoicesList, setEsdInvoicesList] = useState([])
  const [autocountInvoicesList, setAutocountInvoicesList] = useState([])
  const [grnsLoading, setGrnsLoading] = useState(true)
  const [addGRNFormOpen, setAddGRNFormOpen] = useState(false)
  const [addGRNMultiple, setAddGRNMultiple] = useState(false)
  const [addGRNRows, setAddGRNRows] = useState([emptyAddGrnRow()])
  const [addGRNFormError, setAddGRNFormError] = useState('')
  const [addGRNApplyDateToAll, setAddGRNApplyDateToAll] = useState(false)
  const [addGRNConfirmOpen, setAddGRNConfirmOpen] = useState(false)
  const [overwriteGRNModal, setOverwriteGRNModal] = useState({
    open: false,
    conflicts: [],
    nonConflicting: [],
    index: 0,
  })
  const [deliveryModal, setDeliveryModal] = useState({ open: false, rowId: null, dateLabel: '', skipTimeStep: false })
  const [additionalRemarkModal, setAdditionalRemarkModal] = useState({
    open: false,
    rowId: null,
    remark: '',
  })
  const [datePickerRow, setDatePickerRow] = useState(null)
  const [grnDatePickerRow, setGRNDatePickerRow] = useState(null)
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
  const [bulkApplyConfirmModal, setBulkApplyConfirmModal] = useState({
    open: false,
    rowIds: [],
    payload: null,
    onApplied: null,
  })
  const [invoiceSearchModal, setInvoiceSearchModal] = useState({
    open: false,
    forRowId: null,
    attachmentType: 'original',
    deliveryOrderRow: null,
  })
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('')
  const [invoiceSearchSelectedId, setInvoiceSearchSelectedId] = useState(null)
  const [invoiceSearchList, setInvoiceSearchList] = useState([])
  const [invoiceAttachedNotice, setInvoiceAttachedNotice] = useState({ open: false, message: '' })
  const [grnSearchQuery, setGrnSearchQuery] = useState('')
  const getGrnDate = useCallback((row) => row.grnDate, [])
  const getGrnSearch = useCallback((row) => row.grnNo, [])
  const sortGrns = useCallback((list) => sortBySerial(list, (row) => row.grnNo), [])
  const {
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    filteredRows: filteredGRNs,
    pageRows: pagedGRNs,
    currentPage,
    totalPages,
    totalItems: filteredGrnCount,
    goToPage,
  } = useTrackingListView({
    pageKey: 'grn',
    rows: grns,
    searchQuery: grnSearchQuery,
    getDateField: getGrnDate,
    getSearchField: getGrnSearch,
    sortRows: sortGrns,
  })
  const assignDatePendingRef = useRef({
    rowId: null,
    fromDriver: false,
    fromChopSignWarehouse: false,
    fromChopSignNoFlow: null,
  })
  const pendingBulkRowIdsRef = useRef(null)

  const loadGRNs = useCallback(async () => {
    setGrnsLoading(true)
    try {
      const data = await fetchGRNs()
      setGrns(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Fetch GRN error:', e)
      setGrns([])
    }
    setGrnsLoading(false)
  }, [])

  useEffect(() => {
    loadGRNs()
  }, [loadGRNs])

  const loadGrcs = useCallback(async () => {
    try {
      const data = await fetchGRCs()
      setGrcs(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Fetch GRC for GRN link error:', e)
      setGrcs([])
    }
  }, [])

  useEffect(() => {
    loadGrcs()
  }, [loadGrcs])

  useEffect(() => {
    fetchInvoices()
      .then((list) => setEsdInvoicesList(Array.isArray(list) ? list : []))
      .catch((e) => {
        console.error('Fetch ESD invoices for GRN link error:', e)
        setEsdInvoicesList([])
      })
    fetchAutocountInvoices()
      .then((list) => setAutocountInvoicesList(Array.isArray(list) ? list : []))
      .catch((e) => {
        console.error('Fetch Autocount invoices for GRN link error:', e)
        setAutocountInvoicesList([])
      })
  }, [])

  useRealtimeTable('grn', setGrns)
  useRealtimeTable('grc', setGrcs)

  const grcLookup = useMemo(() => buildDocNoLookup(grcs, 'grcNo'), [grcs])
  const grnLookup = useMemo(() => buildDocNoLookup(grns, 'grnNo'), [grns])
  const invoiceLookup = useMemo(
    () => buildCombinedInvoiceLookup(esdInvoicesList, autocountInvoicesList),
    [esdInvoicesList, autocountInvoicesList]
  )
  const syncGuardRef = useRef(false)

  const syncGrnToLinkedInvoice = useCallback(
    async (grnRow) => {
      if (syncGuardRef.current) return
      const linked = resolveLinkedInvoice(grnRow, esdInvoicesList, autocountInvoicesList)
      if (!linked) return
      syncGuardRef.current = true
      try {
        const payload = buildInvoiceUpdateForDocLink(linked, grnRow, grnRow.grnNo)
        const updateApi = linked._linkType === 'autocount' ? updateAutocountInvoice : updateInvoice
        await updateApi(linked.id, payload)
      } catch (e) {
        console.error('Sync GRN to linked invoice error:', e)
      } finally {
        syncGuardRef.current = false
      }
    },
    [esdInvoicesList, autocountInvoicesList]
  )

  const syncGrnToLinkedGrc = useCallback(
    async (grnRow) => {
      if (syncGuardRef.current) return
      const grcRow = resolveLinkedGrc(grnRow, grcs)
      if (!grcRow) return
      syncGuardRef.current = true
      try {
        const merged = mergeLinkedSync(grcRow, grnRow)
        const updated = await updateGRC(grcRow.id, merged)
        if (updated) setGrcs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      } catch (e) {
        console.error('Sync GRN to GRC error:', e)
      } finally {
        syncGuardRef.current = false
      }
    },
    [grcs]
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
  }, [grns])

  const updateRow = (id, updates) => {
    const withTimestamp =
      updates.status !== undefined
        ? { ...updates, statusUpdatedAt: new Date().toISOString() }
        : updates
    setGrns((prev) => {
      const prevRow = prev.find((r) => r.id === id)
      if (updates.status !== undefined && prevRow && updates.status !== prevRow.status) {
        recordStatusTransition(prevRow, updates.status, {
          entityType: 'grn',
          getDocumentNo: (r) => r.grnNo,
        })
      }
      const next = prev.map((row) => (row.id === id ? { ...row, ...withTimestamp } : row))
      const row = next.find((r) => r.id === id)
      if (!row) return next
      updateGRN(id, row)
        .then((updated) => {
            if (updated) {
            setGrns((p) => p.map((r) => (r.id === id ? updated : r)))
            if (hasLinkedGrc(updated, grcs)) syncGrnToLinkedGrc(updated)
            if (hasLinkedInvoice(updated)) syncGrnToLinkedInvoice(updated)
          }
        })
        .catch((e) => console.error('Update GRN error:', e))
      return next
    })
  }

  const deleteRow = (id) => {
    if (!canUseTestMode) return
    deleteGRN(id)
      .then(() => setGrns((prev) => prev.filter((row) => row.id !== id)))
      .catch((e) => console.error('Delete GRN error:', e))
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
    const row = grns.find((r) => r.id === rowId)
    const isHoldOrChopSign =
      row?.status?.startsWith('Hold -') || row?.status?.startsWith('Chop & Sign -')
    if (isHoldOrChopSign) {
      updateRow(rowId, { deliveryDate: parsed, deliverySlot: '' })
      return
    }
    setDeliveryModal({ open: true, rowId, dateLabel: formatDate(parsed), skipTimeStep: false })
    updateRow(rowId, { deliveryDate: parsed, deliverySlot: '' })
  }

  const handleGRNDateChange = (rowId, value) => {
    const parsed = parseDate(value)
    if (parsed) updateRow(rowId, { grnDate: parsed })
    setGRNDatePickerRow(null)
  }

  const handleDeliveryTimeAndAttachmentComplete = ({ slot, attachmentType: type }) => {
    const rowId = deliveryModal.rowId
    if (!rowId) {
      setDeliveryModal({ open: false, rowId: null, dateLabel: '', skipTimeStep: false })
      return
    }
    const row = grns.find((r) => r.id === rowId)
    if (slot != null) {
      const displaySlot = slot === 'Afternoon' ? 'Noon' : slot
      const payload = row
        ? {
            status: row.status,
            assignedSalesmanId: row.assignedSalesmanId,
            assignedDriverId: row.assignedDriverId,
            deliveryDate: row?.deliveryDate ?? '',
            deliverySlot: displaySlot,
          }
        : { deliverySlot: displaySlot, deliveryDate: '' }
      updateRow(rowId, payload)
      afterBulkableCommit(rowId, payload, () => {})
    }
    setDeliveryModal({ open: false, rowId: null, dateLabel: '', skipTimeStep: false })
    if (type === 'none') return
    const grnRow = grns.find((r) => r.id === rowId)
    fetchInvoices().then((list) => {
      setInvoiceSearchList(list)
      setInvoiceSearchQuery('')
      setInvoiceSearchSelectedId(null)
      setInvoiceSearchModal({
        open: true,
        forRowId: rowId,
        attachmentType: type,
        deliveryOrderRow: grnRow || null,
      })
    })
  }

  const getFilteredInvoicesForSearch = () => {
    const q = (invoiceSearchQuery || '').trim().toLowerCase()
    if (!q) return invoiceSearchList
    return invoiceSearchList.filter(
      (inv) => (inv.invoiceNo || '').toLowerCase().includes(q)
    )
  }

  const handleInvoiceSearchConfirm = async () => {
    const { forRowId, attachmentType: type, deliveryOrderRow } = invoiceSearchModal
    if (!forRowId || !deliveryOrderRow) {
      setInvoiceSearchModal({ open: false, forRowId: null, attachmentType: 'original', deliveryOrderRow: null })
      setInvoiceSearchList([])
      return
    }
    const filtered = getFilteredInvoicesForSearch()
    const selectedInvoice = invoiceSearchSelectedId
      ? invoiceSearchList.find((r) => r.id === invoiceSearchSelectedId)
      : filtered.length === 1 ? filtered[0] : null
    if ((type === 'original' || type === 'copy') && !selectedInvoice) return
    const invoiceNo = selectedInvoice?.invoiceNo || selectedInvoice?.id
    if (type === 'original' && selectedInvoice) {
      await updateInvoice(selectedInvoice.id, {
        status: deliveryOrderRow.status,
        assignedDriverId: deliveryOrderRow.assignedDriverId,
        assignedSalesmanId: deliveryOrderRow.assignedSalesmanId,
        deliveryDate: deliveryOrderRow.deliveryDate || '',
        deliverySlot: deliveryOrderRow.deliverySlot || '',
      })
      setInvoiceAttachedNotice({
        open: true,
        message: `Invoice ${invoiceNo} has been updated with GRN ${deliveryOrderRow.grnNo || forRowId}.`,
      })
    }
    if (type === 'copy' && selectedInvoice) {
      const row = grns.find((r) => r.id === forRowId)
      const currentRemark = (row?.remark || '').trim()
      const newRemark = currentRemark
        ? `${currentRemark} / Refer Invoice ${invoiceNo}`
        : `Refer Invoice ${invoiceNo}`
      updateRow(forRowId, { remark: newRemark })
    }
    setInvoiceSearchModal({ open: false, forRowId: null, attachmentType: 'original', deliveryOrderRow: null })
    setInvoiceSearchList([])
    setInvoiceSearchQuery('')
    setInvoiceSearchSelectedId(null)
  }

  const handleInvoiceSearchCancel = () => {
    setInvoiceSearchModal({ open: false, forRowId: null, attachmentType: 'original', deliveryOrderRow: null })
    setInvoiceSearchList([])
    setInvoiceSearchQuery('')
    setInvoiceSearchSelectedId(null)
  }

  const closeAdditionalRemarkModal = () => {
    setAdditionalRemarkModal({ open: false, rowId: null, remark: '' })
  }

  const handleAdditionalRemarkOpen = (rowId) => {
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowId)
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
    const row = grns.find((r) => r.id === rowIdToUse)
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
      const row = grns.find((r) => r.id === rowIdToUse)
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
          setDeliveryModal({ open: true, rowId: rowIdToUse, dateLabel: formatDate(dateToSave), skipTimeStep: false })
        } else {
          const leadRow = grns.find((r) => r.id === rowIdToUse)
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
          setDeliveryModal({ open: true, rowId: rowIdToUse, dateLabel: '', skipTimeStep: true })
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
    const row = grns.find((r) => r.id === rowId)
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

  const handleAddGRNApplyDateToAllChange = (checked) => {
    setAddGRNApplyDateToAll(checked)
    if (checked) {
      const firstDate = addGRNRows[0]?.grnDate || ''
      setAddGRNRows((prev) => prev.map((r) => ({ ...r, grnDate: firstDate })))
    }
  }
  const handleAddGRNMultipleToggle = (on) => {
    setAddGRNMultiple(on)
    if (on) {
      const newRows = Array(10).fill(null).map(() => emptyAddGrnRow())
      setAddGRNRows(newRows)
      setAddGRNApplyDateToAll(false)
    } else {
      const first = addGRNRows[0] ? { ...addGRNRows[0] } : emptyAddGrnRow()
      setAddGRNRows([first])
      setAddGRNApplyDateToAll(false)
    }
  }

  const setAddGRNRow = (index, field, value) => {
    setAddGRNFormError('')
    if (field === 'grnDigits') {
      value = normalizeDigits(value, DO_DIGIT_LEN)
    }
    setAddGRNRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
      if (addGRNApplyDateToAll && field === 'grnDate' && index === 0) {
        return next.map((r, i) => (i === 0 ? r : { ...r, grnDate: value }))
      }
      return next
    })
  }

  const getAddGRNEntries = () => {
    const firstDate = addGRNApplyDateToAll ? (addGRNRows[0]?.grnDate || '') : null
    return addGRNRows
      .map((r) => {
        const grnNo = formatGrnNo(r.grnDigits)
        if (!grnNo) return null
        return {
          grnNo,
          grnDate: addGRNApplyDateToAll ? firstDate : (r.grnDate || ''),
          additionalRemark: (r.additionalRemark || '').trim(),
          attachmentInvoice: r.attachmentInvoice || null,
        }
      })
      .filter(Boolean)
  }

  const linkGrnToInvoice = async (grnRow, attachmentInvoice) => {
    if (!attachmentInvoice?.invoiceNo) return
    const linked = resolveLinkedInvoice(
      { remark: buildRemarkWithLinkedInvoice(attachmentInvoice.invoiceNo, '') },
      esdInvoicesList,
      autocountInvoicesList
    ) || attachmentInvoice
    const payload = buildInvoiceUpdateForDocLink(linked, grnRow, grnRow.grnNo)
    const updateApi = attachmentInvoice._source === 'autocount' ? updateAutocountInvoice : updateInvoice
    await updateApi(attachmentInvoice.id, payload)
  }

  const persistNewGrn = async (entry) => {
    const remark = buildRemarkWithLinkedInvoice(entry.attachmentInvoice?.invoiceNo, '')
    const discrepancy = saveAdditionalRemark(entry.additionalRemark)
    const newRow = createGRN({ grnNo: entry.grnNo, grnDate: entry.grnDate, remark, discrepancy })
    const inserted = await insertGRN(newRow)
    recordInitialStatus({
      entityType: 'grn',
      entityId: inserted.id,
      documentNo: inserted.grnNo,
      status: inserted.status || 'Billed',
      statusAt: inserted.statusUpdatedAt,
    })
    if (entry.attachmentInvoice) {
      await linkGrnToInvoice(inserted, entry.attachmentInvoice)
    }
    return inserted
  }

  const handleAddGRNProceed = () => {
    setAddGRNFormError('')
    const rowsWithDigits = addGRNRows.filter((r) => normalizeDigits(r.grnDigits, DO_DIGIT_LEN).length > 0)
    if (rowsWithDigits.length === 0) {
      setAddGRNFormError('Enter at least one GRN number (5 digits).')
      return
    }
    for (const r of rowsWithDigits) {
      if (!formatGrnNo(r.grnDigits)) {
        setAddGRNFormError('Each GRN number must be exactly 5 digits.')
        return
      }
    }
    const entries = getAddGRNEntries()
    if (entries.length === 0) return
    if (addGRNApplyDateToAll && !addGRNRows[0]?.grnDate) return
    for (const e of entries) {
      if (!addGRNApplyDateToAll && !e.grnDate) return
    }
    setAddGRNConfirmOpen(true)
  }

  const handleAddGRNConfirmYes = async () => {
    const entries = getAddGRNEntries()
    const conflicts = []
    const nonConflicting = []
    for (const e of entries) {
      const existing = grns.find((r) => (r.grnNo || '').trim() === (e.grnNo || '').trim())
      if (existing) conflicts.push({ existingRow: existing, newEntry: e })
      else nonConflicting.push(e)
    }
    if (conflicts.length > 0) {
      setAddGRNConfirmOpen(false)
      setOverwriteGRNModal({ open: true, conflicts, nonConflicting, index: 0 })
      return
    }
    for (const e of nonConflicting) {
      const inserted = await persistNewGrn(e)
      setGrns((prev) => [...prev, inserted])
    }
    setAddGRNFormOpen(false)
    setAddGRNConfirmOpen(false)
    setAddGRNRows([emptyAddGrnRow()])
    setAddGRNApplyDateToAll(false)
  }

  const getGRNRowDisplay = (row) => {
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

  const handleOverwriteGRNYes = async () => {
    const { conflicts, nonConflicting, index } = overwriteGRNModal
    const { existingRow, newEntry } = conflicts[index]
    const resetPayload = {
      grnNo: newEntry.grnNo,
      grnDate: newEntry.grnDate,
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
    updateRow(existingRow.id, resetPayload)
    if (index + 1 < conflicts.length) {
      setOverwriteGRNModal((prev) => ({ ...prev, index: prev.index + 1 }))
    } else {
      for (const e of nonConflicting) {
        const inserted = await persistNewGrn(e)
        setGrns((prev) => [...prev, inserted])
      }
      setOverwriteGRNModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
      setAddGRNFormOpen(false)
      setAddGRNConfirmOpen(false)
      setAddGRNRows([emptyAddGrnRow()])
      setAddGRNApplyDateToAll(false)
    }
  }

  const handleOverwriteGRNNo = async () => {
    const { conflicts, nonConflicting, index } = overwriteGRNModal
    if (index + 1 < conflicts.length) {
      setOverwriteGRNModal((prev) => ({ ...prev, index: prev.index + 1 }))
    } else {
      for (const e of nonConflicting) {
        const inserted = await persistNewGrn(e)
        setGrns((prev) => [...prev, inserted])
      }
      setOverwriteGRNModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
      setAddGRNFormOpen(false)
      setAddGRNConfirmOpen(false)
      setAddGRNRows([emptyAddGrnRow()])
      setAddGRNApplyDateToAll(false)
    }
  }

  const handleAddGRNConfirmNo = () => {
    setAddGRNConfirmOpen(false)
  }

  const handleAddGRNFormClose = () => {
    setAddGRNFormOpen(false)
    setAddGRNConfirmOpen(false)
    setOverwriteGRNModal({ open: false, conflicts: [], nonConflicting: [], index: 0 })
    setAddGRNRows([emptyAddGrnRow()])
    setAddGRNApplyDateToAll(false)
    setAddGRNFormError('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          <div className="flex items-center gap-2 min-w-0">
          <label htmlFor="grn-no-search" className="text-sm font-medium text-slate-700 shrink-0">
            GRN No.
          </label>
          <input
            id="grn-no-search"
            type="text"
            value={grnSearchQuery}
            onChange={(e) => setGrnSearchQuery(e.target.value)}
            placeholder="Search by GRN no."
            className="py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900 w-48 max-w-full text-sm"
            aria-label="Search by GRN number"
          />
          </div>
          <TrackingMonthFilter
            id="grn-month-filter"
            availableMonths={availableMonths}
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <RefreshListButton onRefresh={loadGRNs} loading={grnsLoading} label="Refresh GRN list" />
        <button
          type="button"
          onClick={() => {
            setAddGRNFormOpen(true)
            setAddGRNConfirmOpen(false)
            setAddGRNRows(addGRNMultiple ? Array(10).fill(null).map(() => emptyAddGrnRow()) : [emptyAddGrnRow()])
            setAddGRNFormError('')
            setAddGRNApplyDateToAll(false)
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
        >
          <Plus size={18} />
          Add New GRN
        </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
        {grnsLoading ? (
          <div className="p-8 text-center text-slate-500">Loading GRN…</div>
        ) : filteredGrnCount === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {grnSearchQuery.trim()
              ? 'No GRNs match your search.'
              : selectedMonth
                ? `No GRN for ${formatMonthLabel(selectedMonth)}.`
                : 'No GRN added yet. Click "Add New GRN" to add one.'}
          </div>
        ) : (
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-700 w-12">
                <input
                  type="checkbox"
                  checked={filteredGRNs.length > 0 && selectedInvoiceIds.length === filteredGRNs.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedInvoiceIds(filteredGRNs.map((r) => r.id))
                    else setSelectedInvoiceIds([])
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                  aria-label="Select all GRN"
                />
              </th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 w-12" title="Alert when status has exceeded allowed duration">Alert</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">GRN No</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">GRN Date</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Assigned To</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Assigned Date</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Remark</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Additional Remark</th>
              {canUseTestMode && <th className="text-left py-3 px-4 font-semibold text-slate-700 w-14">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {pagedGRNs.map((row) => {
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
                      aria-label={`Select GRN ${row.grnNo || row.id}`}
                    />
                  </td>
                  <td className="py-2 px-4 w-12 text-center" title={isStatusOverdue(row, alertSettings) ? `Status "${row.status}" has exceeded the allowed duration (Phase ${getPhase(row.status)})` : ''}>
                    {isStatusOverdue(row, alertSettings) ? (
                      <AlertTriangle size={20} className="text-amber-500 inline-block" aria-label="Status overdue" />
                    ) : (
                      <span className="text-slate-300" aria-hidden>–</span>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <span className="py-1.5 px-2 block text-slate-700">
                      {row.grnNo || '–'}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <span className="py-1.5 px-2 block text-slate-700">
                      {row.grnDate ? formatDate(row.grnDate) : '–'}
                    </span>
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
                    {hasLinkedGrc(row, grcs) || hasLinkedInvoice(row) ? (
                      <LinkedTrackingRemark
                        remark={row.remark}
                        grcLookup={grcLookup}
                        grnLookup={grnLookup}
                        invoiceLookup={invoiceLookup}
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
        {!grnsLoading && filteredGrnCount > 0 && (
          <TrackingPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredGrnCount}
            onPageChange={goToPage}
          />
        )}
      </div>

      {/* Add New GRN - Form */}
      {addGRNFormOpen && !addGRNConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Add New GRN</h3>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={addGRNMultiple}
                onChange={(e) => handleAddGRNMultipleToggle(e.target.checked)}
                className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              />
              <span className="text-sm text-slate-700">Add In Multiple</span>
            </label>
            {!addGRNMultiple ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GRN No</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-600 shrink-0">{GRN_NO_PREFIX}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={DO_DIGIT_LEN}
                      value={addGRNRows[0]?.grnDigits || ''}
                      onChange={(e) => setAddGRNRow(0, 'grnDigits', e.target.value)}
                      className="flex-1 py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 font-mono"
                      placeholder="12345"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">GRN Date</label>
                  <input
                    type="date"
                    value={addGRNRows[0]?.grnDate || ''}
                    onChange={(e) => setAddGRNRow(0, 'grnDate', e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Remark</label>
                  <input
                    type="text"
                    value={addGRNRows[0]?.additionalRemark || ''}
                    onChange={(e) => setAddGRNRow(0, 'additionalRemark', e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900"
                    placeholder="Optional"
                  />
                </div>
                <InvoiceAttachmentSearch
                  esdInvoices={esdInvoicesList}
                  autocountInvoices={autocountInvoicesList}
                  query={addGRNRows[0]?.attachmentQuery || ''}
                  onQueryChange={(value) => setAddGRNRow(0, 'attachmentQuery', value)}
                  selected={addGRNRows[0]?.attachmentInvoice || null}
                  onSelect={(inv) => setAddGRNRow(0, 'attachmentInvoice', inv)}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">GRN No</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">GRN Date</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Additional Remark</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700 w-28">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addGRNApplyDateToAll}
                            onChange={(e) => handleAddGRNApplyDateToAllChange(e.target.checked)}
                            className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                          />
                          Apply To All
                        </label>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {addGRNRows.map((row, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-slate-600 shrink-0">{GRN_NO_PREFIX}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={DO_DIGIT_LEN}
                              value={row.grnDigits}
                              onChange={(e) => setAddGRNRow(i, 'grnDigits', e.target.value)}
                              className="w-full py-1.5 px-2 border border-slate-300 rounded text-sm font-mono"
                              placeholder="12345"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={addGRNApplyDateToAll ? (addGRNRows[0]?.grnDate || '') : row.grnDate}
                            onChange={(e) => setAddGRNRow(i, 'grnDate', e.target.value)}
                            disabled={addGRNApplyDateToAll && i > 0}
                            className={`w-full py-1.5 px-2 border rounded text-sm ${addGRNApplyDateToAll && i > 0 ? 'bg-slate-100 border-slate-200' : 'border-slate-300'}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.additionalRemark || ''}
                            onChange={(e) => setAddGRNRow(i, 'additionalRemark', e.target.value)}
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
            {addGRNFormError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{addGRNFormError}</p>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={handleAddGRNFormClose} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleAddGRNProceed} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Add New GRN - Confirm */}
      {addGRNFormOpen && addGRNConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleAddGRNConfirmNo}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirm new GRN</h3>
            <p className="text-slate-600 text-sm mb-4">Please confirm the following. Is all correct?</p>
            <ul className="border border-slate-200 rounded-lg divide-y divide-slate-200 mb-6 max-h-60 overflow-y-auto">
              {getAddGRNEntries().map((e, i) => (
                <li key={i} className="py-2 px-3 flex justify-between text-sm">
                  <span className="font-medium text-slate-800">{e.grnNo}</span>
                  <span className="text-slate-600">{e.grnDate ? formatDate(e.grnDate) : '–'}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleAddGRNConfirmNo} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">No</button>
              <button type="button" onClick={handleAddGRNConfirmYes} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite existing Delivery Order */}
      {overwriteGRNModal.open && overwriteGRNModal.conflicts[overwriteGRNModal.index] && (() => {
        const { existingRow, newEntry } = overwriteGRNModal.conflicts[overwriteGRNModal.index]
        const existingDisplay = getGRNRowDisplay(existingRow)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => handleOverwriteGRNNo()}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Delivery order already exists</h3>
              <p className="text-slate-600 text-sm mb-4">
                <strong>{newEntry.grnNo}</strong> already exists. Do you want to overwrite it? Once overwrite, you may lose the progress of the existing GRN.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Existing</p>
                  <table className="text-sm w-full">
                    <tbody>
                      <tr><td className="text-slate-500 py-1 pr-2">GRN No</td><td className="font-medium">{existingRow.grnNo || '–'}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">GRN Date</td><td>{existingRow.grnDate ? formatDate(existingRow.grnDate) : '–'}</td></tr>
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
                      <tr><td className="text-slate-500 py-1 pr-2">GRN No</td><td className="font-medium">{newEntry.grnNo || '–'}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">GRN Date</td><td>{newEntry.grnDate ? formatDate(newEntry.grnDate) : '–'}</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Status</td><td>Billed</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Assigned To</td><td>–</td></tr>
                      <tr><td className="text-slate-500 py-1 pr-2">Assigned Date</td><td>–</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={handleOverwriteGRNNo} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">No</button>
                <button type="button" onClick={handleOverwriteGRNYes} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">Yes</button>
              </div>
            </div>
          </div>
        )
      })()}

      <DeliveryTimeAndAttachmentModal
        isOpen={deliveryModal.open}
        dateLabel={deliveryModal.dateLabel}
        skipTimeStep={deliveryModal.skipTimeStep}
        onClose={() => setDeliveryModal({ open: false, rowId: null, dateLabel: '', skipTimeStep: false })}
        onComplete={handleDeliveryTimeAndAttachmentComplete}
      />

      {invoiceSearchModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={handleInvoiceSearchCancel}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Search invoice</h3>
            <p className="text-slate-600 text-sm mb-3">Enter invoice number (from Invoice Tracking list):</p>
            <input
              type="text"
              value={invoiceSearchQuery}
              onChange={(e) => {
                setInvoiceSearchQuery(e.target.value)
                setInvoiceSearchSelectedId(null)
              }}
              placeholder="e.g. INV-001"
              className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 mb-3"
              aria-label="Invoice number search"
            />
            <div className="border border-slate-200 rounded overflow-auto flex-1 min-h-[120px] max-h-[200px] mb-4">
              {getFilteredInvoicesForSearch().length === 0 ? (
                <div className="p-4 text-slate-500 text-sm text-center">
                  {invoiceSearchList.length === 0 ? 'No invoices in list.' : 'No match. Type to search.'}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {getFilteredInvoicesForSearch().map((inv) => (
                    <li key={inv.id}>
                      <button
                        type="button"
                        onClick={() => setInvoiceSearchSelectedId(inv.id)}
                        className={`w-full text-left py-2 px-3 text-sm hover:bg-slate-50 ${
                          invoiceSearchSelectedId === inv.id ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700'
                        }`}
                      >
                        {inv.invoiceNo || inv.id}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-slate-500 text-xs mb-3">
              {invoiceSearchSelectedId ? 'Selected: ' + (invoiceSearchList.find((r) => r.id === invoiceSearchSelectedId)?.invoiceNo || invoiceSearchSelectedId) : 'Select an invoice to confirm.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleInvoiceSearchCancel}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvoiceSearchConfirm}
                disabled={!(invoiceSearchSelectedId || getFilteredInvoicesForSearch().length === 1)}
                className="px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm invoice selected
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <NoticeModal
        isOpen={invoiceAttachedNotice.open}
        message={invoiceAttachedNotice.message}
        onClose={() => setInvoiceAttachedNotice({ open: false, message: '' })}
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
        const row = grns.find((r) => r.id === cancelledConfirmModal.rowId)
        const serial = row?.grnNo || cancelledConfirmModal.rowId || 'this document'
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
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Apply to selected GRN?</h3>
            <p className="text-slate-600 text-sm mb-2">
              Are you sure you want to apply this to the following?
            </p>
            <ul className="text-slate-700 text-sm mb-4 max-h-40 overflow-y-auto list-disc list-inside">
              {bulkApplyConfirmModal.rowIds.map((id) => {
                const inv = grns.find((r) => r.id === id)
                return (
                  <li key={id}>{inv?.grnNo || id}</li>
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
