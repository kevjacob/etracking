export const KEG_BRANDS = [
  { key: 'guinness', label: 'Guinness' },
  { key: 'tiger', label: 'Tiger' },
]

export const KEG_SKUS = [
  { value: 'guinness_20l', label: 'Guinness 20L', brand: 'guinness' },
  { value: 'tiger_20l', label: 'Tiger 20L', brand: 'tiger' },
]

export const TENUN_WAREHOUSE_NAME = 'Tenun'
export const HMB_RETURN_TO = 'HMB'
export const KEG_UNIT = 'unit'
export const KEG_DOC_PREFIX = 'IV'

export function parseKegDocDigits(docNo) {
  const raw = String(docNo || '').trim()
  if (raw.toUpperCase().startsWith(KEG_DOC_PREFIX)) {
    return raw.slice(KEG_DOC_PREFIX.length)
  }
  return raw
}

export function formatKegDocNo(digits) {
  const raw = String(digits || '').trim()
  if (!raw) return ''
  const withoutPrefix = raw.toUpperCase().startsWith(KEG_DOC_PREFIX)
    ? raw.slice(KEG_DOC_PREFIX.length).trim()
    : raw
  if (!withoutPrefix) return ''
  return `${KEG_DOC_PREFIX}${withoutPrefix}`
}

export function formatKegQty(quantity) {
  const n = Number(quantity)
  const value = Number.isFinite(n) ? n : 0
  return `${value} ${KEG_UNIT}`
}

export function skuLabel(sku) {
  if (sku === 'heineken_20l') return 'Guinness 20L'
  return KEG_SKUS.find((s) => s.value === sku)?.label || sku || '–'
}

export function skuBrand(sku) {
  if (sku === 'heineken_20l') return 'guinness'
  return KEG_SKUS.find((s) => s.value === sku)?.brand || ''
}

export function brandSku(brand) {
  return KEG_SKUS.find((s) => s.brand === brand)?.value || ''
}

export function getTodayDateStr() {
  const d = new Date()
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

function skuAliases(sku) {
  if (sku === 'guinness_20l') return ['guinness_20l', 'heineken_20l']
  return [sku]
}

export function itemsQtyForSku(items, sku) {
  const aliases = skuAliases(sku)
  return (items || []).reduce((sum, item) => {
    if (!aliases.includes(item?.sku)) return sum
    const n = Number(item.quantity)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

export function formatItemsLabel(items) {
  const parts = (items || [])
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => `${skuLabel(item.sku)} × ${formatKegQty(item.quantity)}`)
  return parts.length ? parts.join(', ') : '–'
}

export function movementLabel(row) {
  const warehouse = row.warehouseName || 'Warehouse'
  const outlet = row.outletName || 'Outlet'
  if (row.movementType === 'dispatch') return `${warehouse} → ${outlet}`
  if (row.movementType === 'return') return `${outlet} → ${warehouse}`
  return '–'
}

function normalizeSkuKey(sku) {
  if (sku === 'heineken_20l') return 'guinness_20l'
  return sku || ''
}

function outletGroupKey(row) {
  const id = String(row?.outletId || '').trim()
  if (id) return `id:${id}`
  const name = String(row?.outletName || '').trim().toLowerCase()
  return name ? `name:${name}` : 'unknown'
}

export function computeOutletDispatchSummary(movements) {
  const map = new Map()
  for (const row of movements || []) {
    const sign = row.movementType === 'dispatch' ? 1 : row.movementType === 'return' ? -1 : 0
    if (!sign) continue
    const key = outletGroupKey(row)
    if (!map.has(key)) {
      map.set(key, {
        key,
        outletId: row.outletId || '',
        outletName: String(row.outletName || '').trim() || 'Unknown outlet',
        bySku: Object.fromEntries(KEG_SKUS.map((sku) => [sku.value, 0])),
      })
    }
    const rec = map.get(key)
    const name = String(row.outletName || '').trim()
    if (name) rec.outletName = name
    if (row.outletId) rec.outletId = row.outletId
    for (const item of row.items || []) {
      const sku = normalizeSkuKey(item.sku)
      if (!sku) continue
      if (!(sku in rec.bySku)) rec.bySku[sku] = 0
      rec.bySku[sku] += sign * (Number(item.quantity) || 0)
    }
  }

  return [...map.values()]
    .map((rec) => ({
      ...rec,
      total: Object.values(rec.bySku).reduce((sum, n) => sum + Number(n || 0), 0),
    }))
    .filter((rec) => rec.total > 0 || Object.values(rec.bySku).some((n) => Number(n) !== 0))
    .sort((a, b) => a.outletName.localeCompare(b.outletName, undefined, { sensitivity: 'base' }))
}

export function computeBrandTotals(brand, movements, stockEntries, excludeMovementId = null) {
  const sku = brandSku(brand)
  let received = 0
  let returnHmb = 0
  for (const entry of stockEntries || []) {
    const entryBrand = skuBrand(entry.sku) || (entry.brand === 'heineken' ? 'guinness' : entry.brand)
    if (entryBrand !== brand) continue
    const qty = Number(entry.quantity) || 0
    if (entry.entryType === 'receive') received += qty
    if (entry.entryType === 'return_hmb') returnHmb += qty
  }

  let dispatched = 0
  let returnedFromOutlet = 0
  for (const row of movements || []) {
    if (excludeMovementId && row.id === excludeMovementId) continue
    const qty = itemsQtyForSku(row.items, sku)
    if (row.movementType === 'dispatch') dispatched += qty
    if (row.movementType === 'return') returnedFromOutlet += qty
  }

  const available = received - dispatched
  const kegsDispatched = dispatched - returnedFromOutlet
  const empty = returnedFromOutlet - returnHmb
  return {
    all: available + kegsDispatched + empty,
    available,
    dispatched: kegsDispatched,
    empty,
  }
}
