import { ShoppingBasket } from 'lucide-react';
import { Link } from 'react-router';

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Al Zaryab Cash & Carry, home">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gold-400 text-brand-700" aria-hidden>
        <ShoppingBasket className="size-6" strokeWidth={2.25} />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-extrabold tracking-tight text-brand-700">Al Zaryab</span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">Cash &amp; Carry</span>
      </span>
    </Link>
  );
}
