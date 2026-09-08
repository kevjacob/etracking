import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  getAvailableMonths,
  filterRowsByMonth,
  paginateRows,
  pickDefaultMonth,
  TRACKING_PAGE_SIZE,
} from '../utils/trackingListFilters'
import { useUserMonthFilter } from './useUserMonthFilter'

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

  const availableMonths = useMemo(
    () => getAvailableMonths(rows, getDateField),
    [rows, getDateField]
  )

  useEffect(() => {
    if (availableMonths.length === 0) {
      if (selectedMonth) setSelectedMonth('')
      return
    }
    if (selectedMonth && availableMonths.includes(selectedMonth)) return
    setSelectedMonth(pickDefaultMonth(availableMonths))
  }, [availableMonths, selectedMonth, setSelectedMonth])

  const filteredRows = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    let list = rows
    if (q) {
      list = list.filter((row) => (getSearchField(row) || '').toLowerCase().includes(q))
    }
    if (selectedMonth) {
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
