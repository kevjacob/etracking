import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchAnnouncements } from '../api/announcements'
import { fetchInvoices as fetchESDInvoices } from '../api/invoices'
import { fetchInvoices as fetchAutocountInvoices } from '../api/autocountInvoices'
import { fetchDeliveryOrders } from '../api/deliveryOrders'
import { fetchGRNs } from '../api/grn'
import { formatDate } from '../utils/dateFormat'
import { isStatusOverdue } from '../utils/alertStatus'

const ROW_HEIGHT = 52
const VISIBLE_ROWS = 5

function sortByDate(list, getDate) {
  return [...list].sort((a, b) => {
    const da = getDate(a)
    const db = getDate(b)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return new Date(db).getTime() - new Date(da).getTime()
  })
}

function AlertBox({ title, items, getSerial, getDate, getStatus, getLastUpdate, getLink, emptyMessage }) {
  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden flex flex-col">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2 shrink-0">
        <AlertTriangle size={20} className="text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      </div>
      <div
        className="overflow-y-auto flex-1 min-h-0"
        style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS }}
      >
        {!items.length ? (
          <div className="px-5 py-4 text-slate-500 text-sm">{emptyMessage}</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {items.map((item) => (
              <li key={item.id} className="hover:bg-slate-50 transition-colors">
                <Link
                  to={getLink(item)}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-2.5 block text-left text-sm"
                >
                  <span className="font-medium text-blue-900 hover:underline shrink-0">
                    {getSerial(item) || item.id}
                  </span>
                  <span className="text-slate-500 shrink-0">
                    {getDate(item) ? formatDate(getDate(item)) : '–'}
                  </span>
                  <span className="text-slate-600 shrink-0">{getStatus(item) || '–'}</span>
                  <span className="text-slate-400 text-xs shrink-0">
                    Last update: {getLastUpdate(item) ? formatDate(getLastUpdate(item)) : '–'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const { user, isSuperuser } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null)
  const [esdInvoices, setEsdInvoices] = useState([])
  const [autocountInvoices, setAutocountInvoices] = useState([])
  const [deliveryOrders, setDeliveryOrders] = useState([])
  const [grns, setGrns] = useState([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)

  useEffect(() => {
    if (!user?.username) return
    setLoadingAnnouncements(true)
    fetchAnnouncements()
      .then((list) => setAnnouncements(Array.isArray(list) ? list : []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoadingAnnouncements(false))
  }, [user?.username])

  useEffect(() => {
    if (!user?.username) return
    setLoadingAlerts(true)
    Promise.all([
      fetchESDInvoices(),
      fetchAutocountInvoices(),
      fetchDeliveryOrders(),
      fetchGRNs(),
    ])
      .then(([esd, autocount, doList, grnList]) => {
        setEsdInvoices(Array.isArray(esd) ? esd : [])
        setAutocountInvoices(Array.isArray(autocount) ? autocount : [])
        setDeliveryOrders(Array.isArray(doList) ? doList : [])
        setGrns(Array.isArray(grnList) ? grnList : [])
      })
      .catch(() => {
        setEsdInvoices([])
        setAutocountInvoices([])
        setDeliveryOrders([])
        setGrns([])
      })
      .finally(() => setLoadingAlerts(false))
  }, [user?.username])

  const esdAlert = useMemo(
    () =>
      sortByDate(
        esdInvoices.filter((row) => row.status !== 'Completed' && row.status !== 'Cancelled' && isStatusOverdue(row)),
        (r) => r.dateOfInvoice
      ),
    [esdInvoices]
  )
  const autocountAlert = useMemo(
    () =>
      sortByDate(
        autocountInvoices.filter(
          (row) => row.status !== 'Completed' && row.status !== 'Cancelled' && isStatusOverdue(row)
        ),
        (r) => r.dateOfInvoice
      ),
    [autocountInvoices]
  )
  const doAlert = useMemo(
    () =>
      sortByDate(
        deliveryOrders.filter(
          (row) => row.status !== 'Completed' && row.status !== 'Cancelled' && isStatusOverdue(row)
        ),
        (r) => r.deliveryOrderDate
      ),
    [deliveryOrders]
  )
  const grnAlert = useMemo(
    () =>
      sortByDate(
        grns.filter(
          (row) => row.status !== 'Completed' && row.status !== 'Cancelled' && isStatusOverdue(row)
        ),
        (r) => r.grnDate
      ),
    [grns]
  )
  const codNotComplete = useMemo(() => {
    const esdCod = (esdInvoices || [])
      .filter((r) => r.cod === true && r.status !== 'Completed' && r.status !== 'Cancelled')
      .map((r) => ({ ...r, _source: 'esd' }))
    const autoCod = (autocountInvoices || [])
      .filter((r) => r.cod === true && r.status !== 'Completed' && r.status !== 'Cancelled')
      .map((r) => ({ ...r, _source: 'autocount' }))
    const combined = [...esdCod, ...autoCod]
    return sortByDate(combined, (r) => r.dateOfInvoice)
  }, [esdInvoices, autocountInvoices])

  if (!user?.username) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-600">Welcome to eTracking.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Announcements: visible to all users; click opens full view modal (no link to manage page for normal users) */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
          <Megaphone size={20} className="text-blue-900" />
          <h2 className="text-lg font-semibold text-slate-800">Announcements</h2>
        </div>
        {loadingAnnouncements ? (
          <div className="px-5 py-4 text-slate-500 text-sm">Loading…</div>
        ) : announcements.length === 0 ? (
          <div className="px-5 py-4 text-slate-500 text-sm">
            {isSuperuser ? (
              <>No announcements. <Link to="/announcement" className="text-blue-900 hover:underline">Manage announcements</Link></>
            ) : (
              'No announcements.'
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {announcements.slice(0, 5).map((ann) => (
              <li key={ann.id} className="hover:bg-slate-50 transition-colors">
                <button
                  type="button"
                  onClick={() => setViewingAnnouncement(ann)}
                  className="flex items-baseline gap-4 px-5 py-3 w-full text-left"
                >
                  <span className="text-slate-500 text-sm shrink-0 w-28">
                    {ann.created_at ? formatDate(ann.created_at) : '—'}
                  </span>
                  <span className="text-blue-900 font-medium hover:underline">{ann.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {isSuperuser && announcements.length > 0 && (
          <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50">
            <Link to="/announcement" className="text-sm text-blue-900 hover:underline">
              View all →
            </Link>
          </div>
        )}
      </div>

      {/* Modal: full announcement (for all users; does not navigate to announcement page) */}
      {viewingAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setViewingAnnouncement(null)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-lg font-semibold text-slate-800">{viewingAnnouncement.title}</h3>
              <button
                type="button"
                onClick={() => setViewingAnnouncement(null)}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto text-slate-700 whitespace-pre-wrap">
              {viewingAnnouncement.body || 'No content.'}
            </div>
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50 text-slate-500 text-sm shrink-0">
              {viewingAnnouncement.created_at ? formatDate(viewingAnnouncement.created_at) : '—'}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Alerts</h2>
        {loadingAlerts ? (
          <p className="text-slate-500 text-sm">Loading alerts…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <AlertBox
              title="ESD Invoice"
              items={esdAlert}
              getSerial={(r) => r.invoiceNo}
              getDate={(r) => r.dateOfInvoice}
              getStatus={(r) => r.status}
              getLastUpdate={(r) => r.statusUpdatedAt}
              getLink={(r) => `/etracking/invoice#row-${r.id}`}
              emptyMessage="No ESD invoices on alert."
            />
            <AlertBox
              title="AC Invoice"
              items={autocountAlert}
              getSerial={(r) => r.invoiceNo}
              getDate={(r) => r.dateOfInvoice}
              getStatus={(r) => r.status}
              getLastUpdate={(r) => r.statusUpdatedAt}
              getLink={(r) => `/etracking/autocount-invoice#row-${r.id}`}
              emptyMessage="No Autocount invoices on alert."
            />
            <AlertBox
              title="Delivery Order"
              items={doAlert}
              getSerial={(r) => r.deliveryOrderNo}
              getDate={(r) => r.deliveryOrderDate}
              getStatus={(r) => r.status}
              getLastUpdate={(r) => r.statusUpdatedAt}
              getLink={(r) => `/etracking/delivery-order#row-${r.id}`}
              emptyMessage="No delivery orders on alert."
            />
            <AlertBox
              title="GRN"
              items={grnAlert}
              getSerial={(r) => r.grnNo}
              getDate={(r) => r.grnDate}
              getStatus={(r) => r.status}
              getLastUpdate={(r) => r.statusUpdatedAt}
              getLink={(r) => `/etracking/grn#row-${r.id}`}
              emptyMessage="No GRNs on alert."
            />
            <AlertBox
              title="C.O.D"
              items={codNotComplete}
              getSerial={(r) => r.invoiceNo}
              getDate={(r) => r.dateOfInvoice}
              getStatus={(r) => r.status}
              getLastUpdate={(r) => r.statusUpdatedAt}
              getLink={(r) => (r._source === 'autocount' ? `/etracking/autocount-invoice#row-${r.id}` : `/etracking/invoice#row-${r.id}`)}
              emptyMessage="No C.O.D bills pending."
            />
          </div>
        )}
      </div>
    </div>
  )
}
