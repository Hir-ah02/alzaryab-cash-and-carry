import type { StockStatus } from '@/api/types';
import { STOCK_LABELS } from '@/utils/format';

import { cx } from './ui';

const STYLES: Record<StockStatus, string> = {
  in: 'bg-brand-50 text-brand-700',
  low: 'bg-gold-100 text-gold-800',
  out: 'bg-danger-bg text-danger',
};

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', STYLES[status], className)}>
      <span className={cx('size-1.5 rounded-full', status === 'in' ? 'bg-brand-600' : status === 'low' ? 'bg-gold-400' : 'bg-danger')} aria-hidden />
      {STOCK_LABELS[status]}
    </span>
  );
}
