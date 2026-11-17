/** Shared test helpers: a scripted fetch and sample API payloads (shapes copied from the Django serializers). */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setApiBaseUrl } from '@/api/client';
import type { ApiCatalogProduct } from '@/api/types';
import { clearTokens, resetTokenCacheForTests, saveTokens } from '@/auth/tokenStorage';
import { resetCheckoutStoreForTests } from '@/checkout/checkoutStore';

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export function jsonResponse(status: number, body?: unknown) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text } as unknown as Response;
}

/** Replaces global fetch. The handler gets each call and returns a response or throws (network failure). */
export function mockFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call: FetchCall = {
      url: String(input),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return calls;
}

export const API_PRODUCT: ApiCatalogProduct = {
  id: 12,
  name: 'Olpers Milk',
  category: 'Dairy & Eggs',
  categoryId: 2,
  description: 'Full cream milk',
  unit: '1 L',
  price: '1250.50',
  image: 'http://localhost:8000/media/products/abc.png',
  stockStatus: 'low',
  inStock: true,
};

export const API_CATEGORY = { id: 2, name: 'Dairy & Eggs', description: '', productCount: 3 };

export const CUSTOMER = {
  id: 7,
  email: 'ali@example.com',
  firstName: 'Ali',
  lastName: 'Raza',
  name: 'Ali Raza',
  phone: '03001112233',
  dateJoined: '2026-11-03T10:00:00+05:00',
};

export function page<T>(results: T[], count = results.length) {
  return { count, next: null, previous: null, results };
}

export type ApiProduct = ApiCatalogProduct;

/** A product in the API's JSON shape. */
export function apiProduct(id: number, overrides: Partial<ApiProduct> = {}): ApiProduct {
  return {
    ...API_PRODUCT,
    id,
    name: `Product ${String(id).padStart(3, '0')}`,
    price: '100.00',
    stockStatus: 'in',
    inStock: true,
    image: null,
    ...overrides,
  };
}

/**
 * Behaves like the Django public catalogue: ?search= (name contains, any case),
 * ?category= (exact name, any case), ?page=&page_size= with `next` links and
 * 404 past the last page; /catalog/products/{id}/ is 404 for unknown ids.
 */
export function catalogHandler(products: ApiProduct[], categories = [API_CATEGORY]) {
  return (call: FetchCall): Response => {
    const url = new URL(call.url);
    if (url.pathname.endsWith('/catalog/categories/')) return jsonResponse(200, categories);

    const detail = url.pathname.match(/\/catalog\/products\/(\d+)\/$/);
    if (detail) {
      const product = products.find((p) => p.id === Number(detail[1]));
      return product ? jsonResponse(200, product) : jsonResponse(404, { detail: 'No Product matches the given query.' });
    }

    if (url.pathname.endsWith('/catalog/products/')) {
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const category = (url.searchParams.get('category') ?? '').toLowerCase();
      const pageNumber = Number(url.searchParams.get('page') ?? '1');
      const size = Number(url.searchParams.get('page_size') ?? '20');
      const matches = products
        .filter((p) => !search || p.name.toLowerCase().includes(search))
        .filter((p) => !category || p.category.toLowerCase() === category)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
      const start = (pageNumber - 1) * size;
      if (pageNumber > 1 && start >= matches.length) return jsonResponse(404, { detail: 'Invalid page.' });
      const next = start + size < matches.length ? `${url.origin}${url.pathname}?page=${pageNumber + 1}` : null;
      return jsonResponse(200, { count: matches.length, next, previous: null, results: matches.slice(start, start + size) });
    }
    return jsonResponse(404, {});
  };
}

/** Product requests (list pages and details) made so far, as "path?query". */
export function productRequests(calls: FetchCall[]) {
  return calls.filter((c) => c.url.includes('/catalog/products/')).map((c) => c.url.replace(/^https?:\/\/[^/]+\/api/, ''));
}

/** The cart as last written to AsyncStorage (read synchronously, so it can be polled inside waitFor). */
export function lastSavedCart(key: string) {
  const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(([k]) => k === key);
  return writes.length ? (JSON.parse(writes[writes.length - 1][1]).items as { productId: number; quantity: number; price: number }[]) : undefined;
}

// ---------- A small fake of the Django customer API (stateful), for screen tests ----------

export const ADDRESS = {
  id: 31,
  label: 'Home',
  recipientName: 'Ali Raza',
  phone: '03001112233',
  line1: 'House 12, Street 4',
  line2: '',
  area: 'Gulberg',
  city: 'Lahore',
  postalCode: '',
  instructions: 'Ring twice',
  isDefault: true,
  createdAt: '2026-11-01T10:00:00+05:00',
  updatedAt: '2026-11-01T10:00:00+05:00',
};

type Json = Record<string, unknown>;

export interface FakeShopOptions {
  products?: ApiCatalogProduct[];
  /** Exact stock per product id (the public API only shows in/low/out). Default 50. */
  stock?: Record<number, number>;
  addresses?: Json[];
  orders?: Json[];
  deliveryFee?: string;
  freeDeliveryFrom?: string | null;
}

const money = (n: number) => n.toFixed(2);

/** Fixture password accepted by the fake API in tests only. */
export const TEST_PASSWORD = 'Grocery#2026';
export const STAFF_EMAIL = 'owner@alzaryab.pk';
/** The code the fake API "emails"; any other 6 digits are wrong. */
export const RESET_CODE = '482913';
export const RESET_SENT = "If there's a customer account for this email, we've sent it a 6-digit code. It expires in 15 minutes. Check your spam folder if it does not arrive.";

/** Order detail in the API's shape. */
export function apiOrder(id: number, overrides: Json = {}): Json {
  return {
    id,
    reference: `AZ-TEST${String(id).padStart(4, '0')}`,
    status: 'pending',
    statusLabel: 'Pending',
    itemCount: 1,
    subtotal: '640.00',
    deliveryFee: '150.00',
    total: '790.00',
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'unpaid',
    createdAt: '2026-11-03T10:05:00+05:00',
    updatedAt: '2026-11-03T10:05:00+05:00',
    items: [{ id: id * 10, productId: 12, productName: 'Olpers Milk', unit: '1 L', unitPrice: '320.00', quantity: 2, lineTotal: '640.00' }],
    delivery: { name: 'Ali Raza', phone: '03001112233', line1: 'House 12, Street 4', line2: '', area: 'Gulberg', city: 'Lahore', postalCode: '', instructions: 'Ring twice' },
    customerNote: '',
    cancelReason: '',
    history: [{ fromStatus: '', toStatus: 'pending', note: '', changedBy: 'You', createdAt: '2026-11-03T10:05:00+05:00' }],
    canCancel: true,
    ...overrides,
  };
}

function summaryOf(order: Json): Json {
  const { items: _i, delivery: _d, customerNote: _c, cancelReason: _r, history: _h, canCancel: _can, ...summary } = order;
  return summary;
}

export function fakeShop(options: FakeShopOptions = {}) {
  const products = options.products ?? [API_PRODUCT];
  const state = {
    stock: { ...Object.fromEntries(products.map((p) => [p.id, p.inStock ? 50 : 0])), ...options.stock } as Record<number, number>,
    addresses: (options.addresses ?? [ADDRESS]).map((a) => ({ ...a })) as Json[],
    orders: (options.orders ?? []).map((o) => ({ ...o })) as Json[],
    customer: { ...CUSTOMER } as Json,
    deliveryFee: Number(options.deliveryFee ?? '150.00'),
    freeDeliveryFrom: options.freeDeliveryFrom ?? null,
    nextId: 500,
    password: TEST_PASSWORD,
    resetRequests: [] as string[],
    /** Return a Response (or throw) to override any call, e.g. to simulate failures. */
    intercept: null as null | ((call: FetchCall) => Response | undefined),
  };
  const catalog = catalogHandler(products);

  function problemsFor(lines: { productId: number; quantity: number }[]) {
    const problems: Json[] = [];
    for (const { productId, quantity } of lines) {
      const product = products.find((p) => p.id === productId);
      const stock = state.stock[productId] ?? 0;
      if (!product) problems.push({ productId, message: 'This product is no longer available.' });
      else if (stock < quantity) {
        problems.push(stock === 0 ? { productId, message: 'This product is out of stock.', available: 0 } : { productId, message: `Only ${stock} left in stock.`, available: stock });
      }
    }
    return problems;
  }

  function price(lines: { productId: number; quantity: number }[]) {
    const items = lines.map(({ productId, quantity }) => {
      const p = products.find((x) => x.id === productId)!;
      return { productId, productName: p.name, unit: p.unit, unitPrice: p.price, quantity, lineTotal: money(Number(p.price) * quantity) };
    });
    const subtotal = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
    const fee = state.freeDeliveryFrom !== null && subtotal >= Number(state.freeDeliveryFrom) ? 0 : state.deliveryFee;
    return { items, subtotal: money(subtotal), deliveryFee: money(fee), total: money(subtotal + fee) };
  }

  const handler = (call: FetchCall): Response => {
    const override = state.intercept?.(call);
    if (override) return override;
    const url = new URL(call.url);
    const path = url.pathname.replace(/^\/api/, '');
    const body = (call.body ?? {}) as Json;

    if (path.startsWith('/catalog/')) return catalog(call);
    if (path === '/customer/auth/logout/') return jsonResponse(204);
    if (path === '/customer/auth/login/') {
      if (body.email === STAFF_EMAIL) return jsonResponse(403, { detail: 'This is an admin account. Please sign in to the Admin Portal instead.', code: 'not_customer' });
      return body.email === state.customer.email && body.password === state.password
        ? jsonResponse(200, { access: 'access-1', refresh: 'refresh-1', user: state.customer })
        : jsonResponse(401, { detail: 'Incorrect email or password.', code: 'invalid_credentials' });
    }
    if (path === '/customer/auth/password-reset/') {
      state.resetRequests.push(String(body.email));
      return jsonResponse(202, { detail: RESET_SENT });
    }
    if (path === '/customer/auth/password-reset/confirm/') {
      if (!/^\d{6}$/.test(String(body.code))) return jsonResponse(400, { code: ['Enter the 6-digit code from the email.'] });
      if (body.email !== state.customer.email || body.code !== RESET_CODE) {
        return jsonResponse(400, { detail: 'This code is wrong or has expired. Check the email or ask for a new code.', code: 'invalid_code' });
      }
      if (String(body.password).length < 8 || /^\d+$/.test(String(body.password)) || body.password === 'password123') {
        return jsonResponse(400, { password: ['This password is too common.'] });
      }
      state.password = String(body.password);
      return jsonResponse(200, { detail: 'Your password has been changed. Sign in with your new password.' });
    }
    if (path === '/customer/auth/register/') {
      if (body.email === state.customer.email) return jsonResponse(400, { email: ['An account with this email already exists.'] });
      state.customer = {
        ...state.customer,
        id: 99,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        name: [body.firstName, body.lastName].filter(Boolean).join(' '),
        phone: body.phone,
      };
      return jsonResponse(201, { access: 'access-new', refresh: 'refresh-new', user: state.customer });
    }
    if (path === '/customer/profile/') {
      if (call.method === 'PATCH') {
        Object.assign(state.customer, body);
        state.customer.name = [state.customer.firstName, state.customer.lastName].filter(Boolean).join(' ');
      }
      return jsonResponse(200, state.customer);
    }

    if (path === '/customer/addresses/') {
      if (call.method === 'POST') {
        const address = { ...body, id: state.nextId++, createdAt: '2026-11-03T12:00:00+05:00', updatedAt: '2026-11-03T12:00:00+05:00' } as Json;
        const makeDefault = body.isDefault === true || state.addresses.length === 0;
        if (makeDefault) state.addresses.forEach((a) => (a.isDefault = false));
        address.isDefault = makeDefault;
        state.addresses.unshift(address);
        return jsonResponse(201, address);
      }
      return jsonResponse(200, [...state.addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)));
    }
    const addressMatch = path.match(/^\/customer\/addresses\/(\d+)\/$/);
    if (addressMatch) {
      const address = state.addresses.find((a) => a.id === Number(addressMatch[1]));
      if (!address) return jsonResponse(404, { detail: 'Not found.' });
      if (call.method === 'DELETE') {
        state.addresses = state.addresses.filter((a) => a !== address);
        if (address.isDefault && state.addresses[0]) state.addresses[0].isDefault = true;
        return jsonResponse(204);
      }
      if (body.isDefault) state.addresses.forEach((a) => (a.isDefault = false));
      Object.assign(address, body);
      return jsonResponse(200, address);
    }

    if (path === '/customer/orders/quote/') {
      const lines = body.items as { productId: number; quantity: number }[];
      const problems = problemsFor(lines);
      if (problems.length) return jsonResponse(400, { detail: 'Some items in your order need attention.', items: problems });
      return jsonResponse(200, { ...price(lines), freeDeliveryFrom: state.freeDeliveryFrom });
    }
    if (path === '/customer/orders/' && call.method === 'POST') {
      const existing = state.orders.find((o) => body.requestId && o.requestId === body.requestId);
      if (existing) {
        const { requestId: _rid, ...rest } = existing;
        return jsonResponse(200, rest);
      }
      const address = state.addresses.find((a) => a.id === body.addressId);
      if (!address) return jsonResponse(400, { addressId: ['Choose one of your saved addresses.'] });
      const lines = body.items as { productId: number; quantity: number }[];
      const problems = problemsFor(lines);
      if (problems.length) return jsonResponse(400, { detail: 'Some items in your order need attention.', items: problems });
      lines.forEach((l) => (state.stock[l.productId] -= l.quantity));
      const priced = price(lines);
      const id = state.nextId++;
      const order = apiOrder(id, {
        ...priced,
        itemCount: lines.length,
        items: priced.items.map((i, n) => ({ id: id * 10 + n, ...i })),
        delivery: { name: address.recipientName, phone: address.phone, line1: address.line1, line2: address.line2, area: address.area, city: address.city, postalCode: address.postalCode, instructions: address.instructions },
        customerNote: body.note ?? '',
        requestId: body.requestId,
      });
      state.orders.unshift(order);
      const { requestId: _rid, ...shown } = order;
      return jsonResponse(201, shown);
    }
    if (path === '/customer/orders/') {
      const pageNumber = Number(url.searchParams.get('page') ?? '1');
      const start = (pageNumber - 1) * 10;
      if (pageNumber > 1 && start >= state.orders.length) return jsonResponse(404, { detail: 'Invalid page.' });
      const next = start + 10 < state.orders.length ? `${url.origin}/api/customer/orders/?page=${pageNumber + 1}` : null;
      return jsonResponse(200, {
        count: state.orders.length,
        next,
        previous: null,
        results: state.orders.slice(start, start + 10).map((o) => {
          const { requestId: _rid, ...rest } = summaryOf(o);
          return rest;
        }),
      });
    }
    const orderMatch = path.match(/^\/customer\/orders\/(\d+)\/(cancel\/)?$/);
    if (orderMatch) {
      const order = state.orders.find((o) => o.id === Number(orderMatch[1]));
      if (!order) return jsonResponse(404, { detail: 'Not found.' });
      if (orderMatch[2]) {
        if (order.status !== 'pending') return jsonResponse(400, { detail: 'This order can no longer be cancelled online. Please contact the store.' });
        Object.assign(order, {
          status: 'cancelled',
          statusLabel: 'Cancelled',
          paymentStatus: 'void',
          canCancel: false,
          cancelReason: body.reason || 'Cancelled by customer',
          history: [...(order.history as Json[]), { fromStatus: 'pending', toStatus: 'cancelled', note: body.reason || 'Cancelled by customer', changedBy: 'You', createdAt: '2026-11-03T11:00:00+05:00' }],
        });
      }
      const { requestId: _rid, ...rest } = order;
      return jsonResponse(200, rest);
    }
    return jsonResponse(404, {});
  };

  return { state, handler };
}

/** Puts a cart on the device as the CartProvider saves it. */
export async function seedCart(items: { productId: number; name: string; unit: string; price: number; quantity: number; image?: string | null }[]) {
  await AsyncStorage.setItem('alzaryab.cart.v1', JSON.stringify({ items: items.map((i) => ({ image: null, ...i })) }));
}

/** Fresh app state for a screen test: API address, no session, empty storage, no pending checkout. */
export async function resetApp({ signedIn = false } = {}) {
  setApiBaseUrl('http://test.local/api');
  await clearTokens();
  resetTokenCacheForTests();
  await AsyncStorage.clear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
  resetCheckoutStoreForTests();
  if (signedIn) {
    await saveTokens({ access: 'access-1', refresh: 'refresh-1' });
    resetTokenCacheForTests();
  }
}

/** True when the element (or the Pressable it belongs to) is disabled. */
export function isDisabled(el: { props: { accessibilityState?: { disabled?: boolean } } }) {
  return !!el.props.accessibilityState?.disabled;
}
