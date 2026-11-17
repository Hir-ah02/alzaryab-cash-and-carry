import { ChevronRight, Package } from 'lucide-react';
import { Link } from 'react-router';

import { OrderStatusBadge } from '@/components/OrderStatus';
import { Button, ButtonLink, Card, EmptyState, ErrorState, PageHeading, Spinner } from '@/components/ui';
import { useOrderPages } from '@/hooks/useCustomer';
import { formatDateTime, formatPrice } from '@/utils/format';

export default function OrdersPage() {
  const orders = useOrderPages();

  if (orders.isPending) return <Spinner label="Loading your orders…" />;
  if (orders.isError) return <ErrorState error={orders.error} onRetry={() => void orders.refetch()} title="Couldn't load your orders" />;

  const list = orders.data.orders;
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeading title="My orders" subtitle={list.length ? `${orders.data.count} ${orders.data.count === 1 ? 'order' : 'orders'}` : undefined} />
      {list.length === 0 ? (
        <EmptyState icon={<Package className="size-7" />} title="No orders yet" text="When you place an order, you can track it here." action={<ButtonLink to="/products">Start shopping</ButtonLink>} />
      ) : (
        <>
          <Card className="divide-y divide-line overflow-hidden">
            {list.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-muted" data-testid="order-row">
                <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 sm:flex"><Package className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">Order {o.reference}</p>
                    <OrderStatusBadge status={o.status} label={o.statusLabel} />
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {formatDateTime(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <p className="font-bold tabular-nums">{formatPrice(o.total)}</p>
                <ChevronRight className="size-5 text-ink-3" aria-hidden />
              </Link>
            ))}
          </Card>
          {orders.hasNextPage && (
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={() => void orders.fetchNextPage()} loading={orders.isFetchingNextPage}>Load older orders</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
