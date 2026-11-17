/**
 * Cash on Delivery checkout (web port of mobile/src/screens/CheckoutScreen.tsx).
 *
 * Before the Place order button is enabled:
 *   - the cart is checked against the live catalogue (useCartCheck) and any price,
 *     pack-size or availability change has been accepted;
 *   - the server has priced the cart (POST /customer/orders/quote/): its subtotal,
 *     delivery fee and total are what's shown, and any stock problem must be fixed;
 *   - a saved delivery address is selected (or added here).
 * Place order checks and prices everything once more, then sends the order with a
 * requestId saved in the browser first (see checkoutStore). The server re-checks stock
 * under row locks, so concurrent orders can never oversell. The cart only changes
 * after the server confirms the order.
 */
import { Banknote, MapPin, Plus, RefreshCw, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { createAddress } from '@/api/customer';
import { ApiError, MESSAGES } from '@/api/errors';
import { samePrice } from '@/api/money';
import type { OrderDetail, OrderLine, OrderProblem } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { reviewCart } from '@/cart/cartCheck';
import { useCart } from '@/cart/CartProvider';
import {
  clearPendingSubmission,
  loadPendingSubmission,
  newRequestId,
  savePendingSubmission,
  selectCheckoutAddress,
  useCheckoutState,
  type PendingSubmission,
} from '@/checkout/checkoutStore';
import { submitOrder } from '@/checkout/submitOrder';
import { AddressForm, AddressText } from '@/components/AddressForm';
import { CartCheckStatus, isCartCheckReady } from '@/components/CartCheckStatus';
import { Button, ButtonLink, Card, cx, EmptyState, Notice, PageHeading, Spinner, SummaryRow, TextArea } from '@/components/ui';
import { useCartCheck } from '@/hooks/useCartCheck';
import { useAddresses, useOrderQuote, useRememberOrder } from '@/hooks/useCustomer';
import { queryKeys } from '@/lib/queryClient';
import { formatPrice } from '@/utils/format';
import { useQueryClient } from '@tanstack/react-query';

export const NOTE_MAX_LENGTH = 500;
const MAX_ADDRESSES = 10;

function Section({ step, title, icon, children }: { step: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">{icon}</span>
        <span><span className="sr-only">Step {step}: </span>{title}</span>
      </h2>
      {children}
    </Card>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { customer } = useAuth();
  const cart = useCart();
  const { items, subtract, setQuantity, remove } = cart;
  const { addressId: chosenAddressId, pending, pendingLoaded } = useCheckoutState();
  const rememberOrder = useRememberOrder();

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [totalChanged, setTotalChanged] = useState<number | null>(null);
  const [uncertain, setUncertain] = useState(false);
  /** True while a new order is on its way: its pending record is already saved, but nothing is uncertain yet. */
  const [placing, setPlacing] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    void loadPendingSubmission();
  }, []);

  const lines = useMemo<OrderLine[]>(() => items.map((i) => ({ productId: i.productId, quantity: i.quantity })), [items]);
  const { query: check, review } = useCartCheck(items, { enabled: pendingLoaded && (!pending || placing) });
  const quote = useOrderQuote(lines, { enabled: pendingLoaded && (!pending || placing) });
  const addresses = useAddresses();

  const addressList = addresses.data ?? [];
  const selectedAddress = addressList.find((a) => a.id === chosenAddressId) ?? addressList.find((a) => a.isDefault) ?? addressList[0] ?? null;
  const showAddressForm = addingAddress || (addresses.isSuccess && addressList.length === 0);

  const problems: OrderProblem[] = quote.error instanceof ApiError ? quote.error.items : [];
  const quoteReady = quote.isSuccess && !quote.isFetching;
  const checkReady = isCartCheckReady(check, review);
  const ready = checkReady && quoteReady && !!selectedAddress && !showAddressForm && items.length > 0 && !pending && !submitting;

  const finish = (order: OrderDetail, sent: PendingSubmission) => {
    subtract(sent.items); // only now, with the order confirmed, does the cart change
    void clearPendingSubmission();
    rememberOrder(order);
    void queryClient.invalidateQueries({ queryKey: queryKeys.catalog }); // stock levels changed
    navigate(`/orders/${order.id}?placed=1`, { replace: true });
  };

  const send = async (submission: PendingSubmission) => {
    const outcome = await submitOrder(submission);
    if (outcome.kind === 'placed') {
      finish(outcome.order, submission);
      return;
    }
    if (outcome.kind === 'uncertain') {
      setUncertain(true); // keep the pending submission: the same requestId is sent again
      return;
    }
    // Rejected: no order was created, so this requestId can be forgotten.
    await clearPendingSubmission();
    const error = outcome.error;
    if (error.status === 401) return; // session ended: the page guard sends the customer to sign in and back
    if (error.items.length > 0) {
      setFormError('Some items changed while you were checking out. Review them below.');
      void quote.refetch();
      void check.refetch();
    } else if (error.fields.addressId) {
      setFormError(error.fields.addressId);
      selectCheckoutAddress(null);
      void addresses.refetch();
    } else {
      setFormError(error.message || MESSAGES.server);
    }
  };

  const placeOrder = async () => {
    if (busy.current || !selectedAddress || !quote.data) return;
    busy.current = true;
    setSubmitting(true);
    setFormError(null);
    setTotalChanged(null);
    try {
      const shownTotal = quote.data.total;
      // Check and price once more right before ordering; never order on an old check.
      const [latestCheck, latestQuote] = await Promise.all([check.refetch(), quote.refetch()]);
      if (!latestCheck.data || reviewCart(items, latestCheck.data).issues.length > 0) return; // shown by CartCheckStatus
      if (!latestQuote.isSuccess || !latestQuote.data) return; // problems are shown below
      if (!samePrice(latestQuote.data.total, shownTotal)) {
        setTotalChanged(latestQuote.data.total);
        return;
      }
      const submission: PendingSubmission = {
        requestId: newRequestId(),
        items: lines,
        addressId: selectedAddress.id,
        note: note.trim(),
        total: latestQuote.data.total,
        createdAt: new Date().toISOString(),
      };
      setPlacing(true);
      await savePendingSubmission(submission); // saved before sending, so a closed tab can't lose the requestId
      await send(submission);
    } catch {
      setFormError(MESSAGES.server);
    } finally {
      busy.current = false;
      setSubmitting(false);
      setPlacing(false);
    }
  };

  const retryPending = async () => {
    if (busy.current || !pending) return;
    busy.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await send(pending);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const discardPending = () => {
    if (!window.confirm('Start a new order? If your earlier order did go through, you can see it in My orders.')) return;
    setUncertain(false);
    void clearPendingSubmission();
  };

  if (!pendingLoaded) return <Spinner label="Preparing checkout…" />;

  // An earlier submission's result is unknown: offer to send exactly the same order again.
  // (Not while a new order is still on its way: the checkout keeps showing its progress.)
  if (pending && !placing) {
    const count = pending.items.reduce((sum, l) => sum + l.quantity, 0);
    return (
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <Notice tone="warning" title="We couldn't confirm your order">
          {`${uncertain ? 'The connection dropped before Al Zaryab answered. ' : ''}Your order of ${count} ${count === 1 ? 'item' : 'items'} (${formatPrice(
            pending.total,
          )}) may already have been received. Press Try again: if it went through you'll see that same order, never a second one. Your cart is unchanged.`}
        </Notice>
        {formError && <Notice tone="error" className="mt-3">{formError}</Notice>}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button icon={<RefreshCw className="size-4" />} onClick={() => void retryPending()} loading={submitting} data-testid="retry-order">Try again</Button>
          <ButtonLink to="/orders" variant="secondary">Check My orders</ButtonLink>
          <Button variant="ghost" onClick={discardPending} disabled={submitting}>Start a new order instead</Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" />}
        title="Your cart is empty"
        text="Add products to your cart, then come back to check out."
        action={<ButtonLink to="/products">Start shopping</ButtonLink>}
      />
    );
  }

  const productName = (id: number) => items.find((i) => i.productId === id)?.name ?? 'A product';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeading title="Checkout" subtitle={<Link to="/cart" className="text-brand-700 hover:underline">← Back to cart</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-5">
          <CartCheckStatus check={check} review={review} />

          <Section step={1} title="Delivery address" icon={<MapPin className="size-4" />}>
            {addresses.isPending ? (
              <Spinner label="Loading your addresses…" className="py-6" />
            ) : addresses.isError ? (
              <Notice tone="error" action={<Button size="sm" variant="secondary" onClick={() => void addresses.refetch()}>Try again</Button>}>
                {addresses.error.message}
              </Notice>
            ) : (
              <>
                {addressList.length > 0 && !addingAddress && (
                  <fieldset>
                    <legend className="sr-only">Choose a delivery address</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {addressList.map((a) => {
                        const checked = selectedAddress?.id === a.id;
                        return (
                          <label key={a.id} className={cx('relative flex cursor-pointer gap-3 rounded-xl border-2 p-3.5 transition-colors', checked ? 'border-brand-600 bg-brand-50/50' : 'border-line hover:border-line-strong')}>
                            <input type="radio" name="address" className="mt-1 size-4 accent-brand-600" checked={checked} onChange={() => selectCheckoutAddress(a.id)} />
                            <div className="min-w-0">
                              {(a.label || a.isDefault) && (
                                <p className="mb-1 flex gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                                  {a.label && <span>{a.label}</span>}
                                  {a.isDefault && <span className="text-brand-700">Default</span>}
                                </p>
                              )}
                              <AddressText address={a} />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {addressList.length < MAX_ADDRESSES && (
                      <Button variant="ghost" size="sm" className="mt-3" icon={<Plus className="size-4" />} onClick={() => setAddingAddress(true)}>
                        Add a new address
                      </Button>
                    )}
                  </fieldset>
                )}
                {showAddressForm && (
                  <>
                    {addressList.length === 0 && <p className="mb-4 text-sm text-ink-2">Where should we deliver your order?</p>}
                    <AddressForm
                      initial={{ recipientName: customer?.name ?? '', phone: customer?.phone ?? '' }}
                      submitLabel="Save and use this address"
                      onCancel={addressList.length > 0 ? () => setAddingAddress(false) : undefined}
                      onSubmit={async (input) => {
                        const created = await createAddress(input);
                        await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
                        selectCheckoutAddress(created.id);
                        setAddingAddress(false);
                      }}
                    />
                  </>
                )}
              </>
            )}
          </Section>

          <Section step={2} title="Payment" icon={<Banknote className="size-4" />}>
            <label className="flex items-start gap-3 rounded-xl border-2 border-brand-600 bg-brand-50/50 p-3.5">
              <input type="radio" name="payment" className="mt-1 size-4 accent-brand-600" checked readOnly />
              <div>
                <p className="font-semibold">Cash on Delivery</p>
                <p className="text-sm text-ink-2">Pay in cash when your order arrives. Please keep the exact amount ready if you can.</p>
              </div>
            </label>
            <div className="mt-4">
              <TextArea
                label="Note for the store"
                optional
                rows={2}
                maxLength={NOTE_MAX_LENGTH}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="E.g. call before arriving"
                hint={`${note.length}/${NOTE_MAX_LENGTH}`}
              />
            </div>
          </Section>
        </div>

        <Card className="p-5 lg:sticky lg:top-40">
          <h2 className="mb-3 text-lg font-bold">Order summary</h2>

          {problems.length > 0 && (
            <Notice tone="error" title="Some items can't be ordered as they are" className="mb-4">
              <ul className="mt-1 space-y-2" data-testid="stock-problems">
                {problems.map((p) => (
                  <li key={p.productId}>
                    <p><span className="font-semibold">{productName(p.productId)}</span>: {p.message}</p>
                    <div className="mt-1 flex gap-3">
                      {p.available !== undefined && p.available > 0 && (
                        <button type="button" className="font-semibold underline" onClick={() => setQuantity(p.productId, p.available!)}>
                          Change to {p.available}
                        </button>
                      )}
                      <button type="button" className="font-semibold underline" onClick={() => remove(p.productId)}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          {quote.isError && problems.length === 0 && (
            <Notice tone="error" className="mb-4" action={<Button size="sm" variant="secondary" onClick={() => void quote.refetch()}>Try again</Button>}>
              {quote.error.message}
            </Notice>
          )}

          {quote.data ? (
            <div className={cx(quote.isFetching && 'opacity-60')}>
              <ul className="mb-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-sm" data-testid="quote-lines">
                {quote.data.items.map((line) => (
                  <li key={line.productId} className="flex justify-between gap-3">
                    <span className="min-w-0"><span className="font-medium">{line.quantity} ×</span> {line.productName} <span className="text-ink-3">({line.unit})</span></span>
                    <span className="shrink-0 tabular-nums">{formatPrice(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line pt-2">
                <dl>
                  <SummaryRow label="Subtotal" value={formatPrice(quote.data.subtotal)} />
                  <SummaryRow label="Delivery fee" value={quote.data.deliveryFee === 0 ? 'Free' : formatPrice(quote.data.deliveryFee)} />
                </dl>
                {quote.data.freeDeliveryFrom !== null && quote.data.deliveryFee > 0 && (
                  <p className="mt-1 text-xs text-brand-700">Free delivery on orders from {formatPrice(quote.data.freeDeliveryFrom)}.</p>
                )}
                <div className="my-2 border-t border-line" />
                <dl><SummaryRow label="Total (Cash on Delivery)" value={<span data-testid="order-total">{formatPrice(quote.data.total)}</span>} strong /></dl>
              </div>
            </div>
          ) : quote.isPending && !quote.isError ? (
            <Spinner label="Calculating your total…" className="py-6" />
          ) : null}

          {totalChanged !== null && (
            <Notice tone="warning" className="mt-4" title="Your total has changed">
              The store updated a price. Your new total is {formatPrice(totalChanged)}. Please review it and place your order again.
            </Notice>
          )}
          {formError && <Notice tone="error" className="mt-4">{formError}</Notice>}

          <Button size="lg" fullWidth className="mt-4" onClick={() => void placeOrder()} disabled={!ready} loading={submitting} data-testid="place-order">
            {quote.data && quoteReady ? `Place order · ${formatPrice(quote.data.total)}` : 'Place order'}
          </Button>
          {!selectedAddress && addresses.isSuccess && <p className="mt-2 text-center text-xs text-ink-2">Add a delivery address to place your order.</p>}
          <p className="mt-3 text-center text-xs text-ink-3">By placing your order you agree to pay the total in cash on delivery.</p>
        </Card>
      </div>
    </div>
  );
}
