import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { cx } from './ui';

/** Site-wide product search: submits to /products?search=…, keeping the chosen category. */
export function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onProducts = location.pathname === '/products';
  const current = onProducts ? params.get('search') ?? '' : '';
  const [value, setValue] = useState(current);

  useEffect(() => setValue(current), [current]);

  const submit = (text: string) => {
    const next = new URLSearchParams();
    if (text.trim()) next.set('search', text.trim());
    const category = onProducts ? params.get('category') : null;
    if (category) next.set('category', category);
    const qs = next.toString();
    navigate(`/products${qs ? `?${qs}` : ''}`, { replace: onProducts });
  };

  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        name="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search for rice, oil, milk…"
        aria-label="Search products"
        autoFocus={autoFocus}
        maxLength={100}
        className="h-11 w-full rounded-xl border border-line-strong bg-surface-muted pl-11 pr-24 text-[15px] placeholder:text-ink-3 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/25 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            if (current) submit('');
          }}
          className="absolute right-[76px] top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
      <button type="submit" className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
        Search
      </button>
    </form>
  );
}
