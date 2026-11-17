// Copied from mobile/src/utils/format.ts (shared business logic, keep the two in step).
/** Grouping with commas: 1250 → "1,250". Done by hand so it is identical on every device. */
function groupThousands(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 1800 → "Rs. 1,800", 1250.5 → "Rs. 1,250.50" (same style as the admin portal). */
export function formatPrice(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const negative = value < 0;
  const [whole, fraction] = Math.abs(value).toFixed(2).split('.');
  const text = fraction === '00' ? groupThousands(whole) : `${groupThousands(whole)}.${fraction}`;
  return `${negative ? '-' : ''}Rs. ${text}`;
}

export const STOCK_LABELS = {
  in: 'In stock',
  low: 'Only a few left',
  out: 'Out of stock',
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-03T10:05:00+05:00" → "3 Nov 2026" in the device's time zone. Built by hand to be identical on every device. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "3 Nov 2026, 10:05 AM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso)}, ${hours}:${minutes} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export const PAYMENT_METHOD_LABELS = { cash_on_delivery: 'Cash on Delivery' } as const;

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'Pay on delivery',
  paid: 'Paid',
  void: 'Nothing to pay (cancelled)',
} as const;
