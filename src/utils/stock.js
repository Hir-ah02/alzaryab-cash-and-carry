/**
 * Single source of truth for the stock rule used everywhere in the portal.
 *   stock > 5   → In Stock
 *   stock 1–5   → Low Stock
 *   stock 0     → Out of Stock
 */
export const LOW_STOCK_MAX = 5;

export const STOCK_STATUS = {
  IN: 'in',
  LOW: 'low',
  OUT: 'out',
};

export const STOCK_STATUS_LABELS = {
  [STOCK_STATUS.IN]: 'In Stock',
  [STOCK_STATUS.LOW]: 'Low Stock',
  [STOCK_STATUS.OUT]: 'Out of Stock',
};

export const STOCK_FILTER_OPTIONS = [
  { value: '', label: 'All Stock' },
  { value: STOCK_STATUS.IN, label: 'In Stock' },
  { value: STOCK_STATUS.LOW, label: 'Low Stock' },
  { value: STOCK_STATUS.OUT, label: 'Out of Stock' },
];

export function getStockStatus(stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0) return STOCK_STATUS.OUT;
  if (qty <= LOW_STOCK_MAX) return STOCK_STATUS.LOW;
  return STOCK_STATUS.IN;
}

export function isValidStockFilter(value) {
  return Object.values(STOCK_STATUS).includes(value);
}
