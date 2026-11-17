import { ORDER_STATUS_LABELS } from '../utils/orders';

/** Pill for an order's status, in the same style as the stock badges. */
export default function OrderStatusBadge({ status }) {
  return (
    <span className={`badge badge--order-${status}`}>
      <span className="badge__dot" aria-hidden="true" />
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
