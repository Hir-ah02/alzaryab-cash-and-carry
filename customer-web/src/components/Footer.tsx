import { Banknote, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
        {[
          { icon: Truck, title: 'Home delivery', text: 'We bring your order to your door.' },
          { icon: Banknote, title: 'Cash on Delivery', text: 'Pay when your groceries arrive.' },
          { icon: ShieldCheck, title: 'Live prices & stock', text: 'Always the store’s current prices.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" aria-hidden /></span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-ink-2">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-ink-2 sm:px-6">
          <p>© {new Date().getFullYear()} Al Zaryab Cash &amp; Carry</p>
          <nav className="flex gap-4" aria-label="Footer">
            <Link to="/products" className="hover:text-brand-700">Shop</Link>
            <Link to="/orders" className="hover:text-brand-700">My orders</Link>
            <Link to="/account" className="hover:text-brand-700">My account</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
