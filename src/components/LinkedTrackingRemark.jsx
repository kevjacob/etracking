import { Link } from 'react-router-dom'
import { isLinkableDoNo, isLinkableGrcNo, splitRemarkParts } from '../utils/grcGrnSync'
import { isLinkableInvoiceNo } from '../utils/invoiceLinkSync'

function RemarkPart({ part, grcLookup, grnLookup, doLookup, invoiceLookup }) {
  const trimmed = String(part ?? '').trim()
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()

  if (isLinkableGrcNo(upper)) {
    const id = grcLookup?.get(upper)
    if (id) {
      return (
        <Link to={`/etracking/grc#row-${id}`} className="text-blue-900 hover:underline font-medium">
          {trimmed}
        </Link>
      )
    }
  }

  if (isLinkableDoNo(upper)) {
    const id = grnLookup?.get(upper)
    if (id) {
      return (
        <Link to={`/etracking/grn#row-${id}`} className="text-blue-900 hover:underline font-medium">
          {trimmed}
        </Link>
      )
    }
  }

  const doId = doLookup?.get(upper)
  if (doId) {
    return (
      <Link to={`/etracking/delivery-order#row-${doId}`} className="text-blue-900 hover:underline font-medium">
        {trimmed}
      </Link>
    )
  }

  if (isLinkableInvoiceNo(trimmed)) {
    const hit = invoiceLookup?.get(trimmed.toUpperCase())
    if (hit) {
      const path = hit.type === 'autocount' ? '/etracking/autocount-invoice' : '/etracking/invoice'
      return (
        <Link to={`${path}#row-${hit.id}`} className="text-blue-900 hover:underline font-medium">
          {trimmed}
        </Link>
      )
    }
  }

  return <span>{trimmed}</span>
}

export default function LinkedTrackingRemark({ remark, grcLookup, grnLookup, doLookup, invoiceLookup, className = '' }) {
  const text = String(remark ?? '').trim()
  if (!text) return <span className={`text-slate-400 ${className}`}>–</span>

  const parts = splitRemarkParts(text)
  return (
    <span className={`text-slate-700 ${className}`}>
      {parts.map((part, index) => (
        <span key={`${index}-${part}`}>
          {index > 0 && <span className="text-slate-400"> | </span>}
          <RemarkPart
            part={part}
            grcLookup={grcLookup}
            grnLookup={grnLookup}
            doLookup={doLookup}
            invoiceLookup={invoiceLookup}
          />
        </span>
      ))}
    </span>
  )
}
