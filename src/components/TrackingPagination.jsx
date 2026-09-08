import { TRACKING_PAGE_SIZE } from '../utils/trackingListFilters'

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 12) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
  return Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)
}

export default function TrackingPagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  pageSize = TRACKING_PAGE_SIZE,
}) {
  if (totalItems === 0) return null

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)
  const pages = getVisiblePages(currentPage, totalPages)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-600">
      <p>
        Showing {start}–{end} of {totalItems}
      </p>
      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 rounded border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {pages.map((page, index) => {
            const prev = pages[index - 1]
            const showEllipsis = prev != null && page - prev > 1
            return (
              <span key={page} className="inline-flex items-center gap-1">
                {showEllipsis && <span className="px-1 text-slate-400">…</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(page)}
                  aria-current={page === currentPage ? 'page' : undefined}
                  className={`min-w-[2.25rem] px-3 py-1.5 rounded border ${
                    page === currentPage
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'border-slate-300 hover:bg-white'
                  }`}
                >
                  {page}
                </button>
              </span>
            )
          })}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
