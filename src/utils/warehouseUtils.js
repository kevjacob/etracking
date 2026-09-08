/** Own warehouse = company's warehouse (shown in Hold-Warehouse / Chop & Sign - Warehouse pickers). */
export function isOwnWarehouse(warehouse) {
  return warehouse?.own !== false
}

export function filterOwnWarehouses(warehouses) {
  return (warehouses || []).filter(isOwnWarehouse)
}
