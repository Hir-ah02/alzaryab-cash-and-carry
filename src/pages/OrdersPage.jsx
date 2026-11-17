import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Banknote, CalendarClock, ClipboardList, Eye, FilterX, Inbox, SearchX } from 'lucide-react';
import { getOrderSummary, listOrders } from '../services/orderService';
import { formatCount, formatPrice } from '../utils/format';
import { useDebouncedValue } from '../utils/hooks';
import { formatDateTime, isValidOrderStatusFilter, ORDER_STATUS_FILTER_OPTIONS } from '../utils/orders';
import PageIntro from '../layout/PageIntro';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import IconButton from '../components/IconButton';
import OrderStatusBadge from '../components/OrderStatusBadge';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import SkeletonRows from '../components/SkeletonRows';
import SummaryCard from '../components/SummaryCard';

const PAGE_SIZE = 10;
const SKELETON_COLUMNS = ['name', 'text', 'text', 'num', 'num', 'pill', 'text', 'actions'];

export default function OrdersPage() {
  // Filters live in the URL (?q=&status=&page=), like the Products page.
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const status = isValidOrderStatusFilter(params.get('status')) ? params.get('status') : '';
  const requestedPage = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);

  const debouncedSearch = useDebouncedValue(search, 250);
  const [listStatus, setListStatus] = useState('loading'); // loading | refreshing | ready | error
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const cardRef = useRef(null);

  const loadSummary = useCallback(() => {
    getOrderSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setListStatus((s) => (s === 'ready' || s === 'refreshing' ? 'refreshing' : 'loading'));
    listOrders({ search: debouncedSearch, status, page: requestedPage, pageSize: PAGE_SIZE })
      .then(({ items, total: count }) => {
        if (cancelled) return;
        setOrders(items);
        setTotal(count);
        setListStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404 && requestedPage > 1) {
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('page');
              return next;
            },
            { replace: true },
          );
          return;
        }
        setListStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status, requestedPage, reloadKey, setParams]);

  const updateParams = (changes, { replace = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace });
  };

  const hasFilters = Boolean(search || status);
  const clearFilters = () => setParams({});
  const reload = () => setReloadKey((k) => k + 1);
  const goToPage = (p) => {
    updateParams({ page: p > 1 ? String(p) : '' });
    cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const isLoading = listStatus === 'loading';
  const isEmpty = (listStatus === 'ready' || listStatus === 'refreshing') && total === 0;
  const summaryLoading = summary === null;

  let body;
  if (listStatus === 'error') {
    body = <ErrorState title="Couldn't load orders" onRetry={reload} />;
  } else if (isEmpty && !hasFilters) {
    body = <EmptyState icon={Inbox} title="No orders yet" text="Orders placed by customers will appear here." />;
  } else if (isEmpty) {
    body = (
      <EmptyState
        icon={SearchX}
        title="No orders match your search"
        text="Try a different reference, name or phone number, or clear the filters."
        action={
          <Button variant="secondary" leadingIcon={FilterX} onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <div className="table-scroll">
          <table className="table" aria-busy={listStatus !== 'ready' || undefined}>
            <caption className="sr-only">Orders</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Area</th>
                <th scope="col" className="num">Items</th>
                <th scope="col" className="num">Total</th>
                <th scope="col">Status</th>
                <th scope="col">Placed</th>
                <th scope="col" className="num">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows columns={SKELETON_COLUMNS} rows={8} />
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`} className="table__name table__link">
                        {o.reference}
                      </Link>
                    </td>
                    <td>
                      <span className="table__name">{o.customer.name}</span>
                      <span className="table__sub">{o.customer.email}</span>
                    </td>
                    <td className="muted">{o.deliveryArea}</td>
                    <td className="num">{o.itemCount}</td>
                    <td className="num">{formatPrice(o.total)}</td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="muted nowrap">{formatDateTime(o.createdAt)}</td>
                    <td className="col-actions">
                      <div className="row-actions row-actions--subtle">
                        <IconButton icon={Eye} variant="edit" label={`View order ${o.reference}`} to={`/orders/${o.id}`} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <Pagination page={requestedPage} pageSize={PAGE_SIZE} total={total} onPageChange={goToPage} itemLabel="orders" />
        )}
      </>
    );
  }

  return (
    <>
      <PageIntro description="Track and update customer orders" />

      <section className="summary-grid" aria-label="Order summary">
        <SummaryCard
          label="Open Orders"
          value={summary?.open ?? 0}
          hint={`${formatCount(summary?.byStatus.pending ?? 0)} waiting for confirmation`}
          icon={ClipboardList}
          tone="warning"
          to="/orders?status=open"
          linkLabel="View open orders"
          loading={summaryLoading}
        />
        <SummaryCard
          label="Orders Today"
          value={summary?.today ?? 0}
          hint={`${formatCount(summary?.total ?? 0)} orders in total`}
          icon={CalendarClock}
          loading={summaryLoading}
        />
        <SummaryCard
          label="Delivered Sales"
          value={summary?.last7DaysRevenue ?? 0}
          format={formatPrice}
          hint="Delivered orders, last 7 days"
          icon={Banknote}
          loading={summaryLoading}
        />
      </section>

      <section className="card" ref={cardRef} aria-label="Orders" style={{ scrollMarginTop: 88 }}>
        <div className="toolbar" role="search">
          <SearchInput
            id="order-search"
            label="Search orders"
            placeholder="Search by order number, customer or phone..."
            className="toolbar__search"
            value={search}
            onChange={(e) => updateParams({ q: e.target.value }, { replace: true })}
            onClear={() => updateParams({ q: '' }, { replace: true })}
          />
          <div className="toolbar__filters">
            <Select
              id="filter-order-status"
              label="Order status"
              hideLabel
              options={ORDER_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(e) => updateParams({ status: e.target.value })}
            />
          </div>
        </div>

        {body}

        <p className="sr-only" aria-live="polite">
          {listStatus === 'ready' ? `${total} ${total === 1 ? 'order' : 'orders'} found` : ''}
        </p>
      </section>
    </>
  );
}
