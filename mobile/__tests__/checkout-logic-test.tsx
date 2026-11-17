import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { setApiBaseUrl } from '@/api/client';
import { ApiError } from '@/api/errors';
import { quoteOrder } from '@/api/orders';
import { clearTokens, resetTokenCacheForTests, saveTokens } from '@/auth/tokenStorage';
import { cartReducer } from '@/cart/cartReducer';
import {
  clearPendingSubmission,
  loadPendingSubmission,
  newRequestId,
  PENDING_KEY,
  resetCheckoutStoreForTests,
  savePendingSubmission,
  useCheckoutState,
  type PendingSubmission,
} from '@/checkout/checkoutStore';
import { isDefiniteRejection, submitOrder } from '@/checkout/submitOrder';

import { API_PRODUCT, fakeShop, jsonResponse, mockFetch } from './helpers';

const PENDING: PendingSubmission = {
  requestId: '6f1c9a4e-2b7d-4c1e-9f3a-8d2e5b7c1a90',
  items: [{ productId: 12, quantity: 2 }],
  addressId: 31,
  note: '',
  total: 2651,
  createdAt: '2026-11-03T10:00:00.000Z',
};

beforeEach(async () => {
  setApiBaseUrl('http://test.local/api');
  await AsyncStorage.clear();
  await clearTokens();
  resetTokenCacheForTests();
  await saveTokens({ access: 'a', refresh: 'r' });
  resetCheckoutStoreForTests();
});

describe('request ids', () => {
  it('are random v4 UUIDs the server accepts', () => {
    const ids = new Set(Array.from({ length: 500 }, newRequestId));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('pending submission', () => {
  it('is saved on the device and restored after a restart', async () => {
    await savePendingSubmission(PENDING);
    expect(JSON.parse((await AsyncStorage.getItem(PENDING_KEY))!)).toEqual(PENDING);
    resetCheckoutStoreForTests();
    await loadPendingSubmission();
    const { result } = await renderHook(() => useCheckoutState());
    expect(result.current).toMatchObject({ pending: PENDING, pendingLoaded: true });
    await act(() => clearPendingSubmission());
    expect(result.current.pending).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('ignores a damaged saved submission', async () => {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ requestId: 'x', items: [{ productId: 1, quantity: 0 }], addressId: 1 }));
    await loadPendingSubmission();
    const { result } = await renderHook(() => useCheckoutState());
    expect(result.current).toMatchObject({ pending: null, pendingLoaded: true });
  });
});

describe('submitOrder', () => {
  it('sends ids and quantities only, with the request id and Cash on Delivery', async () => {
    const shop = fakeShop();
    const calls = mockFetch(shop.handler);
    const outcome = await submitOrder(PENDING);
    expect(outcome.kind).toBe('placed');
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({ items: [{ productId: 12, quantity: 2 }], addressId: 31, note: '', paymentMethod: 'cash_on_delivery', requestId: PENDING.requestId });
    expect(post.headers.Authorization).toBe('Bearer a');
  });

  it('the same request id never creates a second order', async () => {
    const shop = fakeShop();
    mockFetch(shop.handler);
    const first = await submitOrder(PENDING);
    const again = await submitOrder(PENDING);
    expect(first.kind === 'placed' && again.kind === 'placed' && first.order.id === again.order.id).toBe(true);
    expect(shop.state.orders).toHaveLength(1);
    expect(shop.state.stock[12]).toBe(48);
  });

  it('treats server answers before an order exists as rejections', async () => {
    const shop = fakeShop({ stock: { 12: 1 } });
    mockFetch(shop.handler);
    const outcome = await submitOrder(PENDING);
    expect(outcome.kind).toBe('rejected');
    expect(outcome.kind === 'rejected' && outcome.error.items).toEqual([{ productId: 12, message: 'Only 1 left in stock.', available: 1 }]);
    expect(shop.state.orders).toHaveLength(0);
  });

  it.each([
    ['a lost connection', () => { throw new TypeError('Network request failed'); }],
    ['a server error', () => jsonResponse(502, '<html>Bad gateway</html>')],
  ])('treats %s as uncertain', async (_name, handler) => {
    mockFetch(handler);
    expect((await submitOrder(PENDING)).kind).toBe('uncertain');
  });

  it('treats a timeout as uncertain', async () => {
    globalThis.fetch = jest.fn(
      (_url, init?: RequestInit) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))),
    ) as typeof fetch;
    jest.useFakeTimers();
    const pending = submitOrder(PENDING);
    await jest.advanceTimersByTimeAsync(30_000);
    jest.useRealTimers();
    const outcome = await pending;
    expect(outcome.kind).toBe('uncertain');
    expect(outcome.kind === 'uncertain' && (outcome.error as ApiError).code).toBe('timeout');
  });

  it('classifies errors', () => {
    expect(isDefiniteRejection(new ApiError('x', { status: 400 }))).toBe(true);
    expect(isDefiniteRejection(new ApiError('x', { status: 401, code: 'session_expired' }))).toBe(true);
    expect(isDefiniteRejection(new ApiError('x', { status: 0, code: 'not_authenticated' }))).toBe(true);
    expect(isDefiniteRejection(new ApiError('x', { status: 0, code: 'network' }))).toBe(false);
    expect(isDefiniteRejection(new ApiError('x', { status: 0, code: 'timeout' }))).toBe(false);
    expect(isDefiniteRejection(new ApiError('x', { status: 500 }))).toBe(false);
    expect(isDefiniteRejection(new Error('?'))).toBe(false);
  });
});

it('quoteOrder reads the server prices, fee and total', async () => {
  const shop = fakeShop({ freeDeliveryFrom: '5000.00' });
  const calls = mockFetch(shop.handler);
  const quote = await quoteOrder([{ productId: 12, quantity: 2 }]);
  expect(quote).toEqual({
    items: [{ productId: 12, productName: 'Olpers Milk', unit: '1 L', unitPrice: 1250.5, quantity: 2, lineTotal: 2501 }],
    subtotal: 2501,
    deliveryFee: 150,
    total: 2651,
    freeDeliveryFrom: 5000,
  });
  expect(calls[0].body).toEqual({ items: [{ productId: 12, quantity: 2 }] });
});

it('after an order, only the ordered quantities leave the cart', () => {
  const milk = { id: 12, name: 'Milk', unit: '1 L', price: 320, image: null };
  const eggs = { id: 2, name: 'Eggs', unit: '12', price: 390, image: null };
  let state = cartReducer({ items: [] }, { type: 'add', product: milk, quantity: 3 });
  state = cartReducer(state, { type: 'add', product: eggs, quantity: 1 });
  state = cartReducer(state, { type: 'subtract', lines: [{ productId: 12, quantity: 2 }, { productId: 2, quantity: 1 }] });
  expect(state.items.map((i) => [i.productId, i.quantity])).toEqual([[12, 1]]);
  expect(API_PRODUCT.id).toBe(12);
});
