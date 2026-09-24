/**
 * Supabase/PostgREST returns at most 1000 rows per request by default.
 * Page through .range() so tracking lists do not silently drop newer rows.
 */
export const SUPABASE_PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery, { pageSize = SUPABASE_PAGE_SIZE } = {}) {
  const all = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}
