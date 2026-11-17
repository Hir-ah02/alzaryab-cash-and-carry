import { ChevronDown, LogOut, MapPin, Package, ShoppingCart, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { useCart } from '@/cart/CartProvider';
import { useCategories } from '@/hooks/useCatalog';

import { Logo } from './Logo';
import { SearchBox } from './SearchBox';
import { cx } from './ui';

function AccountMenu() {
  const { status, customer, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (status === 'signedOut') {
    return (
      <div className="flex items-center gap-1">
        <Link to="/login" className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-ink hover:bg-brand-50 sm:px-3">
          <User className="size-5" aria-hidden />
          <span className="hidden sm:inline">Sign in</span>
          <span className="sr-only sm:hidden">Sign in</span>
        </Link>
        <Link to="/register" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 lg:flex">
          Create account
        </Link>
      </div>
    );
  }

  const firstName = customer?.firstName || 'Account';
  const item = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-brand-50';
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold hover:bg-brand-50 sm:px-3"
        data-testid="account-menu"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700" aria-hidden>
          {firstName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">{firstName}</span>
        <ChevronDown className="hidden size-4 sm:block" aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{customer?.name || firstName}</p>
            <p className="truncate text-xs text-ink-2">{customer?.email}</p>
          </div>
          <div className="pt-1.5">
            <Link role="menuitem" to="/orders" className={item}><Package className="size-4 text-ink-2" />My orders</Link>
            <Link role="menuitem" to="/account" className={item}><User className="size-4 text-ink-2" />Profile</Link>
            <Link role="menuitem" to="/account/addresses" className={item}><MapPin className="size-4 text-ink-2" />Addresses</Link>
            <button
              role="menuitem"
              type="button"
              className={cx(item, 'w-full text-danger hover:bg-danger-bg')}
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              <LogOut className="size-4" />Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CartButton() {
  const { count } = useCart();
  return (
    <Link to="/cart" className="relative flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700" data-testid="cart-link">
      <ShoppingCart className="size-5" aria-hidden />
      <span className="hidden sm:inline">Cart</span>
      <span className="sr-only">, {count} {count === 1 ? 'item' : 'items'}</span>
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-xs font-bold text-ink" aria-hidden data-testid="cart-count">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

function CategoryBar() {
  const { data } = useCategories();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const active = location.pathname === '/products' ? params.get('category') ?? '' : null;
  const link = (isActive: boolean) =>
    cx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', isActive ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-brand-50 hover:text-brand-700');

  return (
    <nav aria-label="Categories" className="border-t border-line bg-white">
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
        <NavLink to="/products" className={() => link(active === '')} end>
          All products
        </NavLink>
        {data?.map((c) => (
          <Link key={c.id} to={`/products?category=${encodeURIComponent(c.name)}`} className={link(active?.toLowerCase() === c.name.toLowerCase())}>
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 bg-white shadow-[0_1px_0_var(--color-line)]">
      <div className="bg-brand-700 text-white">
        <p className="mx-auto max-w-7xl px-4 py-1.5 text-center text-xs font-medium sm:px-6">
          Fresh groceries delivered to your door · <span className="text-gold-400">Cash on Delivery</span>
        </p>
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        <Logo />
        <SearchBox className="hidden flex-1 md:block md:max-w-xl lg:max-w-2xl" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <AccountMenu />
          <CartButton />
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>
      <CategoryBar />
    </header>
  );
}
