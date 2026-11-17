import { ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { lineTotal } from '@/api/money';
import { useAuth } from '@/auth/AuthProvider';
import { loginPath } from '@/auth/returnTo';
import { useCart } from '@/cart/CartProvider';
import { CartCheckStatus } from '@/components/CartCheckStatus';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Button, ButtonLink, Card, EmptyState, PageHeading, SummaryRow } from '@/components/ui';
import { useCartCheck } from '@/hooks/useCartCheck';
import { formatPrice } from '@/utils/format';

export default function CartPage() {
  const cart = useCart();
  const { status } = useAuth();
  const navigate = useNavigate();
  const { query: check, review } = useCartCheck(cart.items);

  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="size-7" />}
        title="Your cart is empty"
        text="Browse our products and add what you need."
        action={<ButtonLink to="/products">Start shopping</ButtonLink>}
      />
    );
  }

  const hasIssues = (review?.issues.length ?? 0) > 0;
  const low = new Set(review?.lowStock ?? []);
  const goToCheckout = () => navigate(status === 'signedOut' ? loginPath('/checkout') : '/checkout');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeading title="Your cart" subtitle={`${cart.count} ${cart.count === 1 ? 'item' : 'items'}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-4">
          <CartCheckStatus check={check} review={review} />
          <Card className="divide-y divide-line">
            {cart.items.map((item) => (
              <div key={item.productId} className="flex gap-3 p-4 sm:gap-4" data-testid="cart-line">
                <Link to={`/products/${item.productId}`} className="size-20 shrink-0 overflow-hidden rounded-xl border border-line sm:size-24">
                  <ProductImage src={item.image} alt={item.name} className="size-full p-1" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/products/${item.productId}`} className="line-clamp-2 font-semibold hover:text-brand-700">{item.name}</Link>
                      <p className="text-sm text-ink-2">{item.unit} · {formatPrice(item.price)} each</p>
                      {low.has(item.productId) && <p className="text-xs font-medium text-gold-800">Only a few left</p>}
                    </div>
                    <button type="button" onClick={() => cart.remove(item.productId)} className="-mr-2 -mt-1 shrink-0 rounded-lg p-2 text-ink-3 hover:bg-danger-bg hover:text-danger sm:hidden" aria-label={`Remove ${item.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
                    <QuantityStepper size="sm" value={item.quantity} onChange={(q) => cart.setQuantity(item.productId, q)} label={item.name} />
                    <p className="text-right font-bold tabular-nums sm:w-24">{formatPrice(lineTotal(item.price, item.quantity))}</p>
                    <button type="button" onClick={() => cart.remove(item.productId)} className="hidden rounded-lg p-2 text-ink-3 hover:bg-danger-bg hover:text-danger sm:block" aria-label={`Remove ${item.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </Card>
          <Link to="/products" className="inline-block text-sm font-semibold text-brand-700 hover:underline">← Continue shopping</Link>
        </div>

        <Card className="p-5 lg:sticky lg:top-40">
          <h2 className="mb-3 text-lg font-bold">Order summary</h2>
          <dl>
            <SummaryRow label={`Subtotal (${cart.count} ${cart.count === 1 ? 'item' : 'items'})`} value={formatPrice(cart.subtotal)} />
            <SummaryRow label="Delivery" value="At checkout" muted />
          </dl>
          <div className="my-3 border-t border-line" />
          <dl><SummaryRow label="Estimated total" value={formatPrice(cart.subtotal)} strong /></dl>
          <Button size="lg" fullWidth className="mt-4" onClick={goToCheckout} disabled={hasIssues} icon={<ArrowRight className="size-5" />} data-testid="go-to-checkout">
            {status === 'signedOut' ? 'Sign in to check out' : 'Proceed to checkout'}
          </Button>
          {hasIssues && <p className="mt-2 text-center text-xs text-warn">Update your cart above to continue.</p>}
          <p className="mt-3 text-center text-xs text-ink-3">Pay with cash when your order arrives.</p>
        </Card>
      </div>
    </div>
  );
}
