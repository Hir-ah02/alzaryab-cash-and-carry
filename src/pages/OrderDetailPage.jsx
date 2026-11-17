import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CircleX, PackageSearch } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getOrder, updateOrderStatus } from '../services/orderService';
import { formatPrice } from '../utils/format';
import { formatDateTime, NEXT_STEP_LABELS, ORDER_STATUS_LABELS, PAYMENT_LABELS } from '../utils/orders';
import PageIntro from '../layout/PageIntro';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import OrderStatusBadge from '../components/OrderStatusBadge';
import TextArea from '../components/TextArea';

function DetailSkeleton() {
  return (
    <div className="detail-grid" aria-busy="true" aria-label="Loading order">
      <div className="card card__body">
        <span className="skeleton" style={{ height: 220, width: '100%', borderRadius: 12 }} />
      </div>
      <div className="card card__body">
        <span className="skeleton" style={{ height: 160, width: '100%', borderRadius: 12 }} />
      </div>
    </div>
  );
}

function InfoList({ rows }) {
  return (
    <dl className="info-list">
      {rows
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([label, value]) => (
          <div key={label} className="info-list__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [status, setStatus] = useState('loading'); // loading | ready | notFound | error
  const [order, setOrder] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(null); // the status being applied
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getOrder(id));
      setStatus('ready');
    } catch (err) {
      setStatus(err.status === 404 ? 'notFound' : 'error');
    }
  }, [id]);

  useEffect(() => {
    setStatus('loading');
    load();
  }, [load]);

  const applyStatus = async (next) => {
    setSaving(next);
    try {
      const updated = await updateOrderStatus(order.id, next, note.trim());
      setOrder(updated);
      setNote('');
      setConfirmCancel(false);
      toast.success(
        next === 'cancelled' ? 'Order cancelled.' : `Order marked as ${ORDER_STATUS_LABELS[next]}.`,
        next === 'cancelled' ? 'Its items have been returned to stock.' : `${updated.reference} has been updated.`,
      );
    } catch (err) {
      toast.error("Couldn't update the order", err.message);
      setConfirmCancel(false);
      load(); // someone else may have changed it; show the current state
    } finally {
      setSaving(null);
    }
  };

  const reference = order?.reference ?? 'Order';

  return (
    <>
      <PageIntro
        breadcrumb={[{ label: 'Orders', to: '/orders' }, { label: status === 'ready' ? reference : 'Order details' }]}
        description={status === 'ready' ? `Placed ${formatDateTime(order.createdAt)}` : 'Order details'}
      />

      {status === 'loading' && <DetailSkeleton />}

      {status === 'error' && (
        <div className="card">
          <ErrorState title="Couldn't load order" onRetry={load} />
        </div>
      )}

      {status === 'notFound' && (
        <div className="card">
          <EmptyState
            icon={PackageSearch}
            title="Order not found"
            text="This order doesn't exist or the link is incorrect."
            action={
              <Link to="/orders" className="btn btn--secondary">
                <ArrowLeft size={18} aria-hidden="true" />
                <span>Back to Orders</span>
              </Link>
            }
          />
        </div>
      )}

      {status === 'ready' && (
        <div className="detail-grid">
          <div className="detail-grid__main">
            <section className="card" aria-labelledby="order-items-title">
              <div className="card__header">
                <h2 id="order-items-title" className="card__title">
                  Items
                  <span className="count-badge">{order.itemCount}</span>
                </h2>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <caption className="sr-only">Items in order {order.reference}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Unit</th>
                      <th scope="col" className="num">Price</th>
                      <th scope="col" className="num">Qty</th>
                      <th scope="col" className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="table__name">{item.productName}</span>
                        </td>
                        <td className="muted">{item.unit}</td>
                        <td className="num">{formatPrice(item.unitPrice)}</td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{formatPrice(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="order-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(order.subtotal)}</dd>
                </div>
                <div>
                  <dt>Delivery fee</dt>
                  <dd>{order.deliveryFee === 0 ? 'Free' : formatPrice(order.deliveryFee)}</dd>
                </div>
                <div className="order-totals__total">
                  <dt>Total</dt>
                  <dd>{formatPrice(order.total)}</dd>
                </div>
              </dl>
            </section>

            <section className="card" aria-labelledby="order-history-title">
              <div className="card__header">
                <h2 id="order-history-title" className="card__title">
                  History
                </h2>
              </div>
              <ol className="timeline card__body">
                {order.history.map((entry, i) => (
                  <li key={`${entry.toStatus}-${i}`} className="timeline__item">
                    <span className={`timeline__dot timeline__dot--${entry.toStatus}`} aria-hidden="true" />
                    <div>
                      <p className="timeline__title">
                        {ORDER_STATUS_LABELS[entry.toStatus]}
                        {entry.changedBy && <span className="timeline__by"> · {entry.changedBy}</span>}
                      </p>
                      <p className="timeline__time">{formatDateTime(entry.createdAt)}</p>
                      {entry.note && <p className="timeline__note">{entry.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="detail-grid__side">
            <section className="card" aria-labelledby="order-status-title">
              <div className="card__header">
                <h2 id="order-status-title" className="card__title">
                  Status
                </h2>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="card__body form-fields">
                <InfoList
                  rows={[
                    ['Payment', PAYMENT_LABELS[order.paymentMethod]],
                    ['Payment status', PAYMENT_LABELS[order.paymentStatus]],
                    ['Cancellation reason', order.status === 'cancelled' ? order.cancelReason || '—' : ''],
                  ]}
                />
                {order.allowedTransitions.length > 0 ? (
                  <>
                    <TextArea
                      id="status-note"
                      label="Note (optional)"
                      rows={2}
                      maxLength={255}
                      placeholder="e.g. Rider: Imran, or reason for cancelling"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="status-actions">
                      {order.allowedTransitions
                        .filter((next) => next !== 'cancelled')
                        .map((next) => (
                          <Button
                            key={next}
                            block
                            leadingIcon={ArrowRight}
                            loading={saving === next}
                            loadingText="Updating…"
                            disabled={Boolean(saving)}
                            onClick={() => applyStatus(next)}
                          >
                            {NEXT_STEP_LABELS[next]}
                          </Button>
                        ))}
                      {order.allowedTransitions.includes('cancelled') && (
                        <Button
                          block
                          variant="secondary"
                          leadingIcon={CircleX}
                          disabled={Boolean(saving)}
                          onClick={() => setConfirmCancel(true)}
                        >
                          Cancel Order
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="muted">This order is {ORDER_STATUS_LABELS[order.status].toLowerCase()}; its status can't change.</p>
                )}
              </div>
            </section>

            <section className="card" aria-labelledby="order-customer-title">
              <div className="card__header">
                <h2 id="order-customer-title" className="card__title">
                  Customer
                </h2>
              </div>
              <div className="card__body">
                <InfoList
                  rows={[
                    ['Name', order.customer.name],
                    ['Email', <a key="email" href={`mailto:${order.customer.email}`}>{order.customer.email}</a>],
                    ['Phone', order.customer.phone],
                    ['Orders placed', order.customerOrderCount],
                    ['Customer since', formatDateTime(order.customer.dateJoined)],
                  ]}
                />
              </div>
            </section>

            <section className="card" aria-labelledby="order-delivery-title">
              <div className="card__header">
                <h2 id="order-delivery-title" className="card__title">
                  Delivery
                </h2>
              </div>
              <div className="card__body">
                <InfoList
                  rows={[
                    ['Recipient', order.delivery.name],
                    ['Phone', <a key="phone" href={`tel:${order.delivery.phone}`}>{order.delivery.phone}</a>],
                    [
                      'Address',
                      [order.delivery.line1, order.delivery.line2, order.delivery.area, order.delivery.city, order.delivery.postalCode]
                        .filter(Boolean)
                        .join(', '),
                    ],
                    ['Instructions', order.delivery.instructions],
                    ['Customer note', order.customerNote],
                  ]}
                />
              </div>
            </section>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmCancel}
        title="Cancel Order?"
        message={
          <>
            Cancel <strong>{reference}</strong>? All of its items will be returned to stock.
          </>
        }
        warning="This can't be undone."
        cancelLabel="Keep Order"
        confirmLabel="Cancel Order"
        loadingLabel="Cancelling…"
        icon={CircleX}
        loading={saving === 'cancelled'}
        onConfirm={() => applyStatus('cancelled')}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}
