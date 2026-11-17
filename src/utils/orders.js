/**
 * Order lifecycle labels shared by the order screens.
 * The server decides which changes are allowed (order.allowedTransitions);
 * this file only names them.
 *   Pending → Confirmed → Preparing → Out for Delivery → Delivered, or Cancelled
 */

export const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Orders' },
  { value: 'open', label: 'Open Orders' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export function isValidOrderStatusFilter(value) {
  return ORDER_STATUS_FILTER_OPTIONS.some((o) => o.value && o.value === value);
}

/** Button text for moving an order to the given status. */
export const NEXT_STEP_LABELS = {
  confirmed: 'Confirm Order',
  preparing: 'Start Preparing',
  out_for_delivery: 'Send Out for Delivery',
  delivered: 'Mark as Delivered',
};

export const PAYMENT_LABELS = {
  cash_on_delivery: 'Cash on Delivery',
  unpaid: 'Unpaid',
  paid: 'Paid',
  void: 'Void',
};

/** "3 Nov 2026, 10:42 am" for tables and history. */
export function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
