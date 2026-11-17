/**
 * Admin order management (staff only): /api/orders/
 *
 * Money values arrive as decimal strings ("1180.50") and are converted to
 * numbers for display. Totals are always calculated by the server.
 */
import { apiRequest } from './apiClient.js';

const MONEY_FIELDS = ['subtotal', 'deliveryFee', 'total'];

function toOrder(order) {
  const result = { ...order };
  MONEY_FIELDS.forEach((field) => {
    if (field in result) result[field] = Number(result[field]);
  });
  if (Array.isArray(order.items)) {
    result.items = order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    }));
  }
  return result;
}

/**
 * @param {{ search?: string, status?: string, page?: number, pageSize?: number }} params
 *   status: one of the order statuses, 'open' (not delivered or cancelled), or '' for all.
 * @returns {Promise<{ items: Order[], total: number }>} rejects with status 404 past the last page
 */
export async function listOrders({ search = '', status = '', page = 1, pageSize = 10 } = {}) {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (status) query.set('status', status);
  if (page > 1) query.set('page', String(page));
  query.set('page_size', String(pageSize));

  const data = await apiRequest(`/orders/?${query}`);
  return { items: data.results.map(toOrder), total: data.count };
}

/** Full order: items, customer, delivery address, status history, allowedTransitions. */
export async function getOrder(id) {
  return toOrder(await apiRequest(`/orders/${encodeURIComponent(id)}/`));
}

/** Moves the order along its lifecycle. Rejects with a readable message if the change isn't allowed. */
export async function updateOrderStatus(id, status, note = '') {
  return toOrder(await apiRequest(`/orders/${encodeURIComponent(id)}/status/`, { method: 'POST', body: { status, note } }));
}

/** { total, open, today, byStatus: {...}, deliveredRevenue: number, last7DaysRevenue: number } */
export async function getOrderSummary() {
  const data = await apiRequest('/orders/summary/');
  return { ...data, deliveredRevenue: Number(data.deliveredRevenue), last7DaysRevenue: Number(data.last7DaysRevenue) };
}
