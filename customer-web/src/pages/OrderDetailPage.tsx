import { CheckCircle2, PackageX, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { ApiError } from '@/api/errors';
import type { OrderStatus } from '@/api/types';
import { AddressText } from '@/components/AddressForm';
import { OrderStatusBadge, OrderTracker, STATUS_LABELS } from '@/components/OrderStatus';
import { Button, ButtonLink, Card, EmptyState, ErrorState, Notice, Spinner, SummaryRow, TextArea } from '@/components/ui';
import { useCancelOrder, useOrder } from '@/hooks/useCustomer';
import { formatDateTime, formatPrice, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/utils/format';

const OPEN: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'out_for_delivery'];

function CancelOrder({ orderId }: { orderId: number }) {
  const cancel = useCancelOrder(orderId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!open) {
    return <Button variant="danger" onClick={() => setOpen(true)} data-testid="cancel-order">Cancel order</Button>;
  }
  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-danger-bg/50 p-4">
      <p className="text-sm font-semibold">Cancel this order?</p>
      <TextArea label="Reason" optional rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
      {cancel.isError && <Notice tone="error">{cancel.error instanceof ApiError ? cancel.error.message : 'Could not cancel the order.'}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(reason.trim(), { onSuccess: () => setOpen(false) })} data-testid="confirm-cancel">
          Yes, cancel order
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={cancel.isPending}>Keep order</Button>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const justPlaced = params.get('placed') === '1';
  const order = useOrder(id);
  const isOpen = order.data ? OPEN.includes(order.data.status) : false;

  // Keep tracking up to date while the order is still on its way.
  useOrderPolling(isOpen, order.refetch);

  if (!id || !/^\d+$/.test(id) || (order.error instanceof ApiError && order.error.status === 404)) {
    return <EmptyState icon={<PackageX className="size-7" />} title="Order not found" text="We couldn't find this order in your account." action={<ButtonLink to="/orders">My orders</ButtonLink>} />;
  }
  if (order.isPending) return <Spinner label="Loading order…" />;
  if (order.isError) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;

  const o = order.data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {justPlaced && (
        <div className="mb-6 rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center sm:p-8" data-testid="order-confirmation">
          <CheckCircle2 className="mx-auto mb-3 size-12 text-brand-600" aria-hidden />
          <h1 className="text-2xl font-bold">Thank you! Your order has been placed.</h1>
          <p className="mt-2 text-ink-2">
            Order number <span className="font-semibold text-ink" data-testid="order-reference">{o.reference}</span>. Please keep{' '}
            <span className="font-semibold text-ink">{formatPrice(o.total)}</span> ready in cash for delivery.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/products" variant="secondary">Continue shopping</ButtonLink>
            <ButtonLink to="/orders" variant="ghost">View all orders</ButtonLink>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/orders" className="text-sm text-brand-700 hover:underline">← My orders</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {justPlaced ? <h2 className="text-2xl font-bold tracking-tight">Order {o.reference}</h2> : <h1 className="text-2xl font-bold tracking-tight">Order {o.reference}</h1>}
            <OrderStatusBadge status={o.status} label={o.statusLabel} />
          </div>
          <p className="mt-1 text-sm text-ink-2">Placed {formatDateTime(o.createdAt)}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => void order.refetch()} loading={order.isFetching}>Refresh</Button>
      </div>

      <Card className="mb-5 p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Order status</h2>
        <OrderTracker status={o.status} history={o.history} />
        {o.status === 'cancelled' && o.cancelReason && <p className="mt-3 text-sm text-ink-2">Reason: {o.cancelReason}</p>}
        {o.canCancel && <div className="mt-5 border-t border-line pt-4"><p className="mb-3 text-sm text-ink-2">You can cancel while the order is still pending.</p><CancelOrder orderId={o.id} /></div>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <Card className="p-4 sm:p-6">
          <h2 className="mb-3 text-lg font-bold">Items</h2>
          <ul className="divide-y divide-line">
            {o.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-ink-2">{item.unit} · {item.quantity} × {formatPrice(item.unitPrice)}</p>
                </div>
                <p className="font-semibold tabular-nums">{formatPrice(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-2 border-t border-line pt-3">
            <SummaryRow label="Subtotal" value={formatPrice(o.subtotal)} />
            <SummaryRow label="Delivery fee" value={o.deliveryFee === 0 ? 'Free' : formatPrice(o.deliveryFee)} />
            <div className="my-2 border-t border-line" />
            <SummaryRow label="Total" value={formatPrice(o.total)} strong />
          </dl>
        </Card>

        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-2 font-bold">Delivery address</h2>
            <AddressText address={{ ...o.delivery, recipientName: o.delivery.name }} />
          </Card>
          <Card className="p-4 sm:p-5">
            <h2 className="mb-2 font-bold">Payment</h2>
            <p className="text-sm">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</p>
            <p className="text-sm text-ink-2">{PAYMENT_STATUS_LABELS[o.paymentStatus]}</p>
            {o.customerNote && <p className="mt-3 text-sm text-ink-2"><span className="font-medium text-ink">Your note:</span> {o.customerNote}</p>}
          </Card>
          {o.history.length > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-2 font-bold">History</h2>
              <ol className="space-y-2 text-sm">
                {[...o.history].reverse().map((h, i) => (
                  <li key={`${h.createdAt}-${i}`}>
                    <p className="font-medium">{STATUS_LABELS[h.toStatus]}{h.changedBy ? <span className="font-normal text-ink-3"> · {h.changedBy}</span> : null}</p>
                    <p className="text-xs text-ink-2">{formatDateTime(h.createdAt)}</p>
                    {h.note && <p className="text-xs text-ink-2">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}


/** Refetches every 30 s while the tab is visible and the order is still open. */
function useOrderPolling(active: boolean, refetch: () => unknown) {
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refetch();
    }, 30_000);
    return () => clearInterval(timer);
  }, [active, refetch]);
}
