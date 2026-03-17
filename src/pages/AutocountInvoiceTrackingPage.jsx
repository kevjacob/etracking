import InvoiceTrackingPage from './InvoiceTrackingPage'

/**
 * Autocount Invoice Tracking – separate listing from ESD.
 * Same setup (UI/workflow) but uses Autocount invoice storage only.
 */
export default function AutocountInvoiceTrackingPage() {
  return <InvoiceTrackingPage useAutocountStorage />
}
