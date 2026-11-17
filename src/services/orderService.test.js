import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installStorage, jsonResponse, mockFetch, signIn } from './testSupport.js';
import { getOrder, getOrderSummary, listOrders, updateOrderStatus } from './orderService.js';
import {
  createCategory, deactivateCategory, listAllCategories, reactivateCategory, updateCategory,
} from './categoryService.js';
import { createProduct, updateProduct } from './productService.js';

// Shape returned by GET /api/orders/{id}/ (backend/apps/orders/serializers.py).
const API_ORDER = {
  id: 5,
  reference: 'AZ-7K3QF9MD',
  status: 'pending',
  statusLabel: 'Pending',
  itemCount: 2,
  subtotal: '1030.50',
  deliveryFee: '150.00',
  total: '1180.50',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'unpaid',
  items: [{ id: 1, productId: 3, productName: 'Milk', unit: '1 L', unitPrice: '320.00', quantity: 2, lineTotal: '640.00' }],
  allowedTransitions: ['confirmed', 'cancelled'],
};

beforeEach(() => {
  installStorage();
  signIn();
});

describe('orders', () => {
  test('listOrders sends search, status and paging and converts money', async () => {
    const calls = mockFetch(() => jsonResponse(200, { count: 14, results: [API_ORDER] }));
    const result = await listOrders({ search: ' AZ-7K ', status: 'open', page: 2 });
    const url = new URL(calls[0].url, 'http://x');
    assert.equal(url.pathname, '/api/orders/');
    assert.deepEqual(Object.fromEntries(url.searchParams), { search: 'AZ-7K', status: 'open', page: '2', page_size: '10' });
    assert.equal(result.total, 14);
    assert.equal(result.items[0].total, 1180.5);
  });

  test('getOrder converts line and order amounts', async () => {
    mockFetch(() => jsonResponse(200, API_ORDER));
    const order = await getOrder(5);
    assert.equal(order.subtotal, 1030.5);
    assert.equal(order.deliveryFee, 150);
    assert.equal(order.items[0].unitPrice, 320);
    assert.equal(order.items[0].lineTotal, 640);
  });

  test('updateOrderStatus posts the new status and note', async () => {
    const calls = mockFetch(() => jsonResponse(200, { ...API_ORDER, status: 'confirmed' }));
    const order = await updateOrderStatus(5, 'confirmed', 'Rider: Imran');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].url, '/api/orders/5/status/');
    assert.deepEqual(calls[0].body, { status: 'confirmed', note: 'Rider: Imran' });
    assert.equal(order.status, 'confirmed');
  });

  test('a refused status change surfaces the server message', async () => {
    mockFetch(() => jsonResponse(400, { detail: "An order that is Delivered can't be changed to Cancelled." }));
    const err = await updateOrderStatus(5, 'cancelled').catch((e) => e);
    assert.equal(err.message, "An order that is Delivered can't be changed to Cancelled.");
  });

  test('getOrderSummary converts revenue to numbers', async () => {
    mockFetch(() => jsonResponse(200, { total: 3, open: 1, today: 2, byStatus: {}, deliveredRevenue: '1180.50', last7DaysRevenue: '0.00' }));
    const summary = await getOrderSummary();
    assert.equal(summary.deliveredRevenue, 1180.5);
    assert.equal(summary.last7DaysRevenue, 0);
  });
});

describe('category management', () => {
  test('uses the admin category endpoints', async () => {
    const calls = mockFetch((call) => (call.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(200, [])));
    await listAllCategories();
    await createCategory({ name: '  Pet Food ' });
    await updateCategory(7, { name: ' Pets ' });
    await deactivateCategory(7);
    await reactivateCategory(7);
    assert.deepEqual(
      calls.map((c) => [c.method, c.url, c.body]),
      [
        ['GET', '/api/categories/?include_inactive=true', undefined],
        ['POST', '/api/categories/', { name: 'Pet Food', description: '' }],
        ['PATCH', '/api/categories/7/', { name: 'Pets' }],
        ['DELETE', '/api/categories/7/', undefined],
        ['PATCH', '/api/categories/7/', { active: true }],
      ],
    );
  });
});

describe('product description and availability', () => {
  test('are sent as JSON fields and in multipart uploads', async () => {
    const calls = mockFetch(() => jsonResponse(200, { id: 1, price: '1.00' }));
    const form = { name: 'Milk', category: 'Dairy & Eggs', unit: '1 L', stock: '1', price: '1', description: ' Fresh ', isAvailable: false };
    await updateProduct(1, { ...form, image: undefined });
    assert.equal(calls[0].body.description, 'Fresh');
    assert.equal(calls[0].body.isAvailable, false);

    await createProduct({ ...form, isAvailable: true, image: new File(['x'], 'a.png', { type: 'image/png' }) });
    assert.equal(calls[1].rawBody.get('isAvailable'), 'true');
    assert.equal(calls[1].rawBody.get('description'), 'Fresh');
  });
});
