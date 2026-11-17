/** The signed-in customer's orders. Other customers' orders always return 404. */
import { apiRequest } from './client';
import { toMoney } from './money';
import type {
  ApiOrderDetail,
  ApiOrderQuote,
  ApiOrderSummary,
  OrderDetail,
  OrderLine,
  OrderQuote,
  OrderSummary,
  Paginated,
  PlaceOrderInput,
} from './types';

/** Placing an order can take longer than a catalogue read (row locks, stock movements). */
export const PLACE_ORDER_TIMEOUT_MS = 30_000;

export function toOrderSummary(o: ApiOrderSummary): OrderSummary {
  return { ...o, subtotal: toMoney(o.subtotal), deliveryFee: toMoney(o.deliveryFee), total: toMoney(o.total) };
}

export function toOrderDetail(o: ApiOrderDetail): OrderDetail {
  return {
    ...o,
    subtotal: toMoney(o.subtotal),
    deliveryFee: toMoney(o.deliveryFee),
    total: toMoney(o.total),
    items: o.items.map((i) => ({ ...i, unitPrice: toMoney(i.unitPrice), lineTotal: toMoney(i.lineTotal) })),
  };
}

export function toOrderQuote(q: ApiOrderQuote): OrderQuote {
  return {
    items: q.items.map((i) => ({ ...i, unitPrice: toMoney(i.unitPrice), lineTotal: toMoney(i.lineTotal) })),
    subtotal: toMoney(q.subtotal),
    deliveryFee: toMoney(q.deliveryFee),
    total: toMoney(q.total),
    freeDeliveryFrom: q.freeDeliveryFrom === null ? null : toMoney(q.freeDeliveryFrom),
  };
}

/**
 * POST /customer/orders/quote/  Server prices, delivery fee and total for these lines.
 * Rejects with ApiError.items (same problems as placing the order) when something can't be ordered.
 */
export async function quoteOrder(items: OrderLine[], signal?: AbortSignal): Promise<OrderQuote> {
  return toOrderQuote(await apiRequest<ApiOrderQuote>('/customer/orders/quote/', { method: 'POST', body: { items }, auth: 'required', signal }));
}

/** GET /customer/orders/  Newest first, 10 per page. */
export async function listOrders(page = 1, signal?: AbortSignal): Promise<Paginated<OrderSummary>> {
  const query = page > 1 ? `?page=${page}` : '';
  const data = await apiRequest<Paginated<ApiOrderSummary>>(`/customer/orders/${query}`, { auth: 'required', signal });
  return { ...data, results: data.results.map(toOrderSummary) };
}

export async function getOrder(id: number | string, signal?: AbortSignal): Promise<OrderDetail> {
  return toOrderDetail(await apiRequest<ApiOrderDetail>(`/customer/orders/${encodeURIComponent(id)}/`, { auth: 'required', signal }));
}

/**
 * POST /customer/orders/  201 new order · 200 the same order again (same requestId).
 * Stock problems reject with ApiError.items = [{ productId, message, available? }].
 */
export async function placeOrder(input: PlaceOrderInput): Promise<OrderDetail> {
  const body = { paymentMethod: 'cash_on_delivery', note: '', ...input };
  return toOrderDetail(
    await apiRequest<ApiOrderDetail>('/customer/orders/', { method: 'POST', body, auth: 'required', timeoutMs: PLACE_ORDER_TIMEOUT_MS }),
  );
}

/** POST /customer/orders/{id}/cancel/  Only while Pending (order.canCancel); stock is returned. */
export async function cancelOrder(id: number, reason = ''): Promise<OrderDetail> {
  return toOrderDetail(
    await apiRequest<ApiOrderDetail>(`/customer/orders/${id}/cancel/`, { method: 'POST', body: { reason }, auth: 'required' }),
  );
}
