import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { useEmployees } from '../context/EmployeesContext'
import { useWarehouses } from '../context/WarehousesContext'
import { formatDate, toInputDate, parseDate } from '../utils/dateFormat'
import { fetchInvoices, insertInvoice, updateInvoice, deleteInvoice } from '../api/invoices'
import DeliverySlotModal from '../components/DeliverySlotModal'
import DiscrepancyModal from '../components/DiscrepancyModal'
import SelectSalesmanModal from '../components/SelectSalesmanModal'
import SelectClerkModal from '../components/SelectClerkModal'
import SelectWarehouseModal from '../components/SelectWarehouseModal'
import HoldWarehouseTypeModal from '../components/HoldWarehouseTypeModal'
import SelectDriverModal from '../components/SelectDriverModal'
import NoticeModal from '../components/NoticeModal'

function getTodayDateStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isSupabaseId(id) {
  return typeof id === 'string' && UUID_REGEX.test(id)
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
]

const STATUS_REQUIRES_SALESMAN = ['Hold - Salesman', 'Chop & Sign - Salesman']
const STATUS_REQUIRES_CLERK = ['Hold - Office', 'Chop & Sign - Office']
const STATUS_TRANSFER = 'Transfer'
const DELIVERED_VALIDATION_MSG = 'Assigned person and date is missing, please go to preparing delivery.'
const DELIVERY_IN_PROGRESS_VALIDATION_MSG = 'Driver and Delivery date yet to be assigned.'

const defaultDiscrepancy = () => ({ checked: false, title: '', description: '' })

function createInvoice(overrides = {}) {
  return {
    id: String(Date.now() + Math.random()),
    invoiceNo: '',
    dateOfInvoice: '',
    status: 'Billed',
    assignedDriverId: null,
    assignedSalesmanId: null,
    assignedClerkId: null,
    transferWarehouseId: null,
    holdWarehouseId: null,
    holdWarehouseType: '',
    deliveryDate: '',
    deliverySlot: '',
    remark: '',
    discrepancy: defaultDiscrepancy(),
    ...overrides,
  }
}

export default function InvoiceTrackingPage() {
  const { employees } = useEmployees()
  const { warehouses } = useWarehouses()
  const drivers = employees.filter((e) => e.position === 'Lorry Driver')
  const salesmen = employees.filter((e) => e.position === 'Salesman')
  const [testMode, setTestMode] = useState(false)
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
  const [driverModal, setDriverModal] = useState({ open: false, rowId: null, previousStatus: '' })
  const [rearrangeDeliveryConfirmModal, setRearrangeDeliveryConfirmModal] = useState({
    open: false,
    rowId: null,
  })
  const [completedConfirmModal, setCompletedConfirmModal] = useState({ open: false, rowId: null })

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    try {
      const data = await fetchInvoices()
      if (data.length === 0) {
        setInvoices([createInvoice({ invoiceNo: 'INV-001', dateOfInvoice: '2025-02-20' })])
      } else {
        setInvoices(data)
      }
    } catch (e) {
      console.error('Fetch invoices error:', e)
      setInvoices([createInvoice({ invoiceNo: 'INV-001', dateOfInvoice: '2025-02-20' })])
    }
    setInvoicesLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const updateRow = (id, updates) => {
    setInvoices((prev) => {
      const next = prev.map((row) => (row.id === id ? { ...row, ...updates } : row))
      const row = next.find((r) => r.id === id)
      if (!row || !testMode) return next
      if (isSupabaseId(id)) {
        updateInvoice(id, row).catch((e) => console.error('Update invoice error:', e))
      } else {
        insertInvoice(row)
          .then((inserted) => {
            setInvoices((p) => p.map((r) => (r.id === id ? inserted : r)))
          })
          .catch((e) => console.error('Insert invoice error:', e))
      }
      return next
    })
  }

  const deleteRow = (id) => {
    if (!testMode) return
    if (!isSupabaseId(id)) {
      setInvoices((prev) => prev.filter((row) => row.id !== id))
      return
    }
    deleteInvoice(id)
      .then(() => setInvoices((prev) => prev.filter((row) => row.id !== id)))
      .catch((e) => console.error('Delete invoice error:', e))
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
    updateRow(deliveryModal.rowId, { deliverySlot: displaySlot })
    setDeliveryModal({ open: false, rowId: null, dateLabel: '' })
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
    if (newStatus === 'Delivered') {
      if (!row.assignedDriverId || !row.deliveryDate || !row.deliverySlot) {
        setDeliveredNoticeOpen(true)
        return
      }
    }
    if (newStatus === 'Preparing Delivery' && row.status === 'Delivery In Progress') {
      setRearrangeDeliveryConfirmModal({ open: true, rowId })
      return
    }
    if (newStatus === 'Completed') {
      setCompletedConfirmModal({ open: true, rowId })
      return
    }
    const clearDriverForHoldOrChop =
      newStatus.startsWith('Hold -') || newStatus.startsWith('Chop & Sign -')
    if (newStatus === 'Delivery In Progress') {
      updateRow(rowId, {
        status: newStatus,
        assignedSalesmanId: null,
        assignedDriverId: null,
      })
      setPreparingDeliveryTypeModal({ open: true, rowId, previousStatus })
    } else if (STATUS_REQUIRES_SALESMAN.includes(newStatus)) {
      updateRow(rowId, { status: newStatus, assignedDriverId: null })
      setSalesmanModal({ open: true, rowId, previousStatus })
    } else if (STATUS_REQUIRES_CLERK.includes(newStatus)) {
      updateRow(rowId, { status: newStatus, assignedDriverId: null })
      setClerkModal({ open: true, rowId, previousStatus })
    } else if (newStatus === STATUS_TRANSFER) {
      updateRow(rowId, { status: newStatus })
      setWarehouseModal({ open: true, rowId, previousStatus })
    } else if (newStatus === 'Hold - Warehouse') {
      updateRow(rowId, { status: newStatus, assignedDriverId: null })
      setHoldWarehouseModal({ open: true, rowId, previousStatus })
    } else {
      updateRow(rowId, {
        status: newStatus,
        assignedSalesmanId: null,
        assignedClerkId: null,
        transferWarehouseId: null,
        ...(clearDriverForHoldOrChop ? { assignedDriverId: null } : {}),
      })
    }
  }

  const handleSalesmanSelect = (rowId, salesmanId) => {
    updateRow(rowId, { assignedSalesmanId: salesmanId })
    setSalesmanModal({ open: false, rowId: null, previousStatus: '' })
    const row = invoices.find((r) => r.id === rowId)
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
    updateRow(rowId, {
      transferWarehouseId: warehouseId,
      deliveryDate: getTodayDateStr(),
      deliverySlot: '',
    })
    setWarehouseModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleWarehouseModalCancel = (rowId, previousStatus) => {
    updateRow(rowId, { status: previousStatus, transferWarehouseId: null })
    setWarehouseModal({ open: false, rowId: null, previousStatus: '' })
  }

  const handleHoldWarehouseSelect = (rowId, warehouseId) => {
    const warehouse = warehouses.find((w) => w.id === warehouseId)
    setHoldWarehouseModal({ open: false, rowId: null, previousStatus: '' })
    if (warehouse?.name?.toLowerCase() === 'keruing') {
      updateRow(rowId, {
        status: 'Hold - Warehouse',
        holdWarehouseId: warehouseId,
        holdWarehouseType: null,
        assignedDriverId: null,
        deliveryDate: getTodayDateStr(),
        deliverySlot: '',
      })
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

  const handleHoldWarehouseTypeSelect = (type) => {
    const { rowId, warehouseId } = holdWarehouseTypeModal
    updateRow(rowId, {
      status: 'Hold - Warehouse',
      holdWarehouseId: warehouseId,
      holdWarehouseType: type,
      assignedDriverId: null,
      deliveryDate: getTodayDateStr(),
      deliverySlot: '',
    })
    setHoldWarehouseTypeModal({ open: false, rowId: null, warehouseId: null, warehouseName: '', previousStatus: '' })
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
    if (rowId) {
      updateRow(rowId, {
        status: 'Preparing Delivery',
        assignedDriverId: null,
        assignedSalesmanId: null,
        deliveryDate: '',
        deliverySlot: '',
      })
    }
    setRearrangeDeliveryConfirmModal({ open: false, rowId: null })
  }

  const handleRearrangeDeliveryNo = () => {
    setRearrangeDeliveryConfirmModal({ open: false, rowId: null })
  }

  const handleCompletedConfirmYes = () => {
    const { rowId } = completedConfirmModal
    if (rowId) {
      updateRow(rowId, { status: 'Completed' })
    }
    setCompletedConfirmModal({ open: false, rowId: null })
  }

  const handleCompletedConfirmNo = () => {
    setCompletedConfirmModal({ open: false, rowId: null })
  }

  const handleAssignDateConfirm = () => {
    const { rowId, selectedDate, fromDriver } = assignDateModal
    if (!rowId) return
    const dateStr = selectedDate || getTodayDateStr()
    const parsed = parseDate(dateStr)
    const dateToSave = parsed || getTodayDateStr()
    updateRow(rowId, { deliveryDate: dateToSave, deliverySlot: '' })
    setAssignDateModal({ open: false, rowId: null, selectedDate: '', fromDriver: false })
    if (fromDriver) {
      setDeliveryModal({ open: true, rowId, dateLabel: formatDate(dateToSave) })
    }
  }

  const handleAssignDateCancel = () => {
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
    updateRow(rowId, { assignedDriverId: driverId })
    setDriverModal({ open: false, rowId: null, previousStatus: '' })
    const row = invoices.find((r) => r.id === rowId)
    setAssignDateModal({
      open: true,
      rowId,
      selectedDate: row?.deliveryDate || getTodayDateStr(),
      fromDriver: true,
    })
  }

  const handleDriverModalCancel = (rowId, previousStatus) => {
    updateRow(rowId, { status: previousStatus, assignedDriverId: null })
    setDriverModal({ open: false, rowId: null, previousStatus: '' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm font-medium text-slate-700">Test Mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={testMode}
            onClick={() => setTestMode((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              testMode ? 'bg-blue-900' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                testMode ? 'translate-x-6' : 'translate-x-0.5'
              }`}
              style={{ marginTop: 2 }}
            />
          </button>
        </label>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
        {invoicesLoading ? (
          <div className="p-8 text-center text-slate-500">Loading invoices…</div>
        ) : (
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Invoice No</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Date of Invoice</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Assigned To</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Assigned Date</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Remark</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700">Discrepancy</th>
              {testMode && <th className="text-left py-3 px-4 font-semibold text-slate-700 w-14">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {invoices.map((row) => {
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
              const canEditInvoiceFields = testMode
              const isRowCompleted = row.status === 'Completed'
              const isCompletedLocked = isRowCompleted && !testMode
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
                  isDeliveryInProgress ||
                  isDelivered)
              const isAssignedDateInactive = row.status === 'Billed'
              const isHoldWarehouseWithWarehouse = row.status === 'Hold - Warehouse' && row.holdWarehouseId
              const isDriverDateLocked =
                isDeliveryInProgress || isDelivered || isHoldWarehouseWithWarehouse
              const driverMissing = isDeliveryInProgress && !row.assignedDriverId
              const dateMissing = isDeliveryInProgress && (!row.deliveryDate || !row.deliverySlot)
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

              return (
                <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={row.invoiceNo}
                      onChange={(e) => updateRow(row.id, { invoiceNo: e.target.value })}
                      readOnly={!canEditRow}
                      className={`w-full max-w-[120px] py-1.5 px-2 border rounded ${
                        canEditRow
                          ? 'border-slate-300 focus:ring-2 focus:ring-blue-900'
                          : 'border-transparent bg-transparent read-only:bg-transparent'
                      }`}
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
                        Completed
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
                      className={`py-1.5 px-2 block min-w-[140px] ${
                        dateMissing ? 'bg-red-50 text-red-700 border border-red-300 rounded' : 'text-slate-700'
                      }`}
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
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            checked={row.discrepancy?.checked ?? false}
                            onChange={(e) =>
                              e.target.checked
                                ? handleDiscrepancyCheck(row.id, true)
                                : handleDiscrepancyCheck(row.id, false)
                            }
                            className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                          />
                          {row.discrepancy?.checked && row.discrepancy?.title ? (
                            <span
                              className="relative group/tip max-w-[120px] truncate"
                              title={row.discrepancy?.description}
                            >
                              <span className="text-slate-700">{row.discrepancy.title}</span>
                              {row.discrepancy.description && (
                                <span className="absolute left-0 bottom-full mb-1 hidden group-hover/tip:block z-10 py-2 px-3 bg-slate-800 text-white text-xs rounded shadow-lg max-w-[220px] whitespace-normal">
                                  {row.discrepancy.description}
                                </span>
                              )}
                            </span>
                          ) : (
                            row.discrepancy?.checked && (
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
                                className="text-blue-900 text-xs underline"
                              >
                                Add details
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  {testMode && !isCompletedLocked && (
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

      {rearrangeDeliveryConfirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleRearrangeDeliveryNo}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Rearrange delivery?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Assigned to and assigned date will be reset for Preparing Delivery.
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

      {assignDateModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={handleAssignDateCancel}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Select date</h3>
            <input
              type="date"
              value={assignDateModal.selectedDate ? toInputDate(assignDateModal.selectedDate) : toInputDate(getTodayDateStr())}
              onChange={(e) =>
                setAssignDateModal((prev) => ({ ...prev, selectedDate: e.target.value || getTodayDateStr() }))
              }
              className="w-full py-2 px-3 border border-slate-300 rounded focus:ring-2 focus:ring-blue-900 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleAssignDateCancel}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignDateConfirm}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
