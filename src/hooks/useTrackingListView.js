import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  getAvailableMonths,
  filterRowsByMonth,
  paginateRows,
  pickDefaultMonth,
  TRACKING_PAGE_SIZE,
  ALL_MONTHS_VALUE,
  isSpecificMonth,
} from '../utils/trackingListFilters'
import { useUserMonthFilter } from './useUserMonthFilter'

function readFocusMonth(pageKey) {
  try {
    const key = `etracking_focus_month_${pageKey}`
    const focus = sessionStorage.getItem(key)
    if (!focus) return ''
    sessionStorage.removeItem(key)
    return focus
  } catch {
    return ''
  }
}

/**
 * Search + per-user month filter + pagination for tracking list pages.
 */
export function useTrackingListView({
  pageKey,
  rows,
  searchQuery,
  getDateField,
  getSearchField,
  sortRows,
}) {
  const { selectedMonth, setSelectedMonth } = useUserMonthFilter(pageKey)
  const [currentPage, setCurrentPage] = useState(1)
  const focusMonthRef = useRef(null)

  const availableMonths = useMemo(
    () => getAvailableMonths(rows, getDateField),
    [rows, getDateField]
  )

  useEffect(() => {
    if (focusMonthRef.current === null) {
      focusMonthRef.current = readFocusMonth(pageKey)
    }
    if (availableMonths.length === 0) {
      if (isSpecificMonth(selectedMonth)) setSelectedMonth('')
      return
    }
    if (focusMonthRef.current) {
      const focus = focusMonthRef.current
      focusMonthRef.current = ''
      if (focus === ALL_MONTHS_VALUE || availableMonths.includes(focus)) {
        setSelectedMonth(focus)
        return
      }
    }
    if (selectedMonth === ALL_MONTHS_VALUE) return
    if (selectedMonth && availableMonths.includes(selectedMonth)) return
    setSelectedMonth(pickDefaultMonth(availableMonths))
  }, [availableMonths, pageKey, selectedMonth, setSelectedMonth])

  const filteredRows = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    let list = rows
    if (q) {
      // Search all months so imported / other-month documents are findable.
      list = list.filter((row) => (getSearchField(row) || '').toLowerCase().includes(q))
    } else if (isSpecificMonth(selectedMonth)) {
      list = filterRowsByMonth(list, selectedMonth, getDateField)
    }
    return sortRows(list)
  }, [rows, searchQuery, selectedMonth, getDateField, getSearchField, sortRows])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedMonth])

  const pagination = useMemo(
    () => paginateRows(filteredRows, currentPage, TRACKING_PAGE_SIZE),
    [filteredRows, currentPage]
  )

  useEffect(() => {
    if (currentPage > pagination.totalPages) {
      setCurrentPage(pagination.totalPages)
    }
  }, [pagination.totalPages, currentPage])

  const goToPage = useCallback((page) => {
    setCurrentPage(page)
  }, [])

  return {
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    filteredRows,
    pageRows: pagination.pageRows,
    currentPage: pagination.page,
    totalPages: pagination.totalPages,
    totalItems: pagination.totalItems,
    pageSize: TRACKING_PAGE_SIZE,
    goToPage,
  }
}
