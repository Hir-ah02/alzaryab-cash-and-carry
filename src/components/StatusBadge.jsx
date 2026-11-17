import { getStockStatus, STOCK_STATUS_LABELS } from '../utils/stock';

const CLASSES = { in: 'badge--in-stock', low: 'badge--low-stock', out: 'badge--out-of-stock' };

/** Pill showing In Stock / Low Stock / Out of Stock for a stock quantity. */
export default function StatusBadge({ stock }) {
  const status = getStockStatus(stock);
  return (
    <span className={`badge ${CLASSES[status]}`}>
      <span className="badge__dot" aria-hidden="true" />
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}
