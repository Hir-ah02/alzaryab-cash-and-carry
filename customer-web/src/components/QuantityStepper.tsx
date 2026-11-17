import { Minus, Plus, Trash2 } from 'lucide-react';

import { MAX_QUANTITY_PER_ITEM } from '@/cart/cartReducer';

import { cx } from './ui';

interface Props {
  value: number;
  onChange: (next: number) => void;
  /** Lowest allowed value; with min 0 the minus button turns into "remove" at 1. */
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label: string;
  disabled?: boolean;
}

export function QuantityStepper({ value, onChange, min = 1, max = MAX_QUANTITY_PER_ITEM, size = 'md', label, disabled }: Props) {
  const removes = min === 0 && value <= 1;
  const btn = cx(
    'flex items-center justify-center text-ink transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent',
    size === 'sm' ? 'size-8' : 'size-10',
  );
  return (
    <div className={cx('inline-flex items-center rounded-xl border border-line-strong bg-white', disabled && 'opacity-60')} role="group" aria-label={label}>
      <button
        type="button"
        className={cx(btn, 'rounded-l-xl')}
        onClick={() => onChange(value - 1)}
        disabled={disabled || (!removes && value <= min)}
        aria-label={removes ? `Remove ${label}` : `Decrease ${label}`}
      >
        {removes ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={`${label} quantity`}
        onChange={(e) => {
          const next = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className={cx(
          'border-x border-line-strong bg-transparent text-center font-semibold tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none',
          size === 'sm' ? 'h-8 w-10 text-sm' : 'h-10 w-12',
        )}
      />
      <button
        type="button"
        className={cx(btn, 'rounded-r-xl')}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
