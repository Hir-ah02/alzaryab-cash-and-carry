import { Check, X } from 'lucide-react';

import type { OrderHistoryEntry, OrderStatus } from '@/api/types';
import { formatDateTime } from '@/utils/format';

import { cx } from './ui';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STYLES: Record<OrderStatus, string> = {
  pending: 'bg-gold-100 text-gold-800',
  confirmed: 'bg-sky-50 text-sky-800',
  preparing: 'bg-indigo-50 text-indigo-800',
  out_for_delivery: 'bg-violet-50 text-violet-800',
  delivered: 'bg-brand-50 text-brand-700',
  cancelled: 'bg-danger-bg text-danger',
};

export function OrderStatusBadge({ status, label }: { status: OrderStatus; label?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', STYLES[status])} data-testid="order-status">
      {label || STATUS_LABELS[status]}
    </span>
  );
}

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

/** Progress through the delivery steps, with the time each step was reached. */
export function OrderTracker({ status, history }: { status: OrderStatus; history: OrderHistoryEntry[] }) {
  const reachedAt = (s: OrderStatus) => history.find((h) => h.toStatus === s)?.createdAt;

  if (status === 'cancelled') {
    const at = reachedAt('cancelled');
    return (
      <div className="flex items-center gap-3 rounded-xl bg-danger-bg p-4 text-danger">
        <span className="flex size-8 items-center justify-center rounded-full bg-danger text-white"><X className="size-4" /></span>
        <div>
          <p className="font-semibold">This order was cancelled</p>
          {at && <p className="text-sm">{formatDateTime(at)}</p>}
        </div>
      </div>
    );
  }

  const current = STEPS.indexOf(status);
  return (
    <ol className="grid gap-3 sm:grid-cols-5 sm:gap-0" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const done = i <= current;
        const at = reachedAt(step);
        return (
          <li key={step} className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:text-center" aria-current={i === current ? 'step' : undefined}>
            {i > 0 && <span className={cx('absolute left-[15px] -top-3 h-3 w-0.5 sm:left-auto sm:right-1/2 sm:top-4 sm:h-0.5 sm:w-full', i <= current ? 'bg-brand-600' : 'bg-line')} aria-hidden />}
            <span className={cx('relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold', done ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink-3')}>
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <div className="sm:mt-2">
              <p className={cx('text-sm font-semibold', !done && 'text-ink-3')}>{STATUS_LABELS[step]}</p>
              {at && done && <p className="text-xs text-ink-2">{formatDateTime(at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
