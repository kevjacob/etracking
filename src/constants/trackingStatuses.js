/** Workflow statuses shared by Invoice, DO, GRN tracking pages. */
export const TRACKING_STATUS_OPTIONS = [
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
  'Cancelled',
]

/** Settings key for C.O.D alert period (not a workflow status). */
export const COD_ALERT_SETTING_KEY = '__cod__'
