/** Order history. The test that opens an order (navigation) is last. */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { apiOrder, fakeShop, jsonResponse, mockFetch, resetApp } from './helpers';

beforeEach(() => resetApp({ signedIn: true }));

const ORDERS = Array.from({ length: 13 }, (_, i) => apiOrder(100 - i, { reference: `AZ-ORD${String(100 - i)}`, total: `${1000 + i}.00` }));

async function open(orders = ORDERS) {
  const shop = fakeShop({ orders });
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/orders' });
  return { shop, listCalls: () => calls.filter((c) => c.url.includes('/customer/orders/') && c.method === 'GET').map((c) => c.url.replace(/^.*\/api/, '')) };
}

it('lists orders with reference, date, status, total and payment status', async () => {
  await open([apiOrder(7, { reference: 'AZ-7K3QF9MD', status: 'delivered', statusLabel: 'Delivered', paymentStatus: 'paid', total: '1180.50', itemCount: 3 })]);
  expect(await screen.findByText('AZ-7K3QF9MD')).toBeTruthy();
  expect(screen.getByText('3 Nov 2026 · 3 items')).toBeTruthy();
  expect(screen.getByText('Delivered')).toBeTruthy();
  expect(screen.getByText('Rs. 1,180.50')).toBeTruthy();
  expect(screen.getByText('Paid')).toBeTruthy();
});

it('loads the next page when scrolled to the end', async () => {
  const { listCalls } = await open();
  expect(await screen.findByText('AZ-ORD100')).toBeTruthy();
  expect(screen.queryByText('AZ-ORD88')).toBeNull();
  await fireEvent(screen.getByLabelText('Your orders'), 'onEndReached');
  await waitFor(() => expect(listCalls()).toEqual(['/customer/orders/', '/customer/orders/?page=2']));
  await fireEvent(screen.getByLabelText('Your orders'), 'onEndReached');
  expect(listCalls()).toHaveLength(2); // no page 3
});

it('shows an empty state', async () => {
  await open([]);
  expect(await screen.findByText('No orders yet')).toBeTruthy();
});

it('shows a network error with retry', async () => {
  const shop = fakeShop({ orders: ORDERS });
  mockFetch((call) => {
    if (call.url.includes('/customer/orders/')) throw new TypeError('Network request failed');
    return shop.handler(call);
  });
  await renderRouter('src/app', { initialUrl: '/orders' });
  expect(await screen.findByText("You're offline", {}, { timeout: 8000 })).toBeTruthy();
  expect(screen.getByLabelText('Try again')).toBeTruthy();
}, 15000);

it('a server-side 404 for someone else’s order shows “Order not found”', async () => {
  const shop = fakeShop({ orders: [] });
  mockFetch((call) => (call.url.endsWith('/customer/orders/999/') ? jsonResponse(404, { detail: 'Not found.' }) : shop.handler(call)));
  await renderRouter('src/app', { initialUrl: '/orders/999' });
  expect(await screen.findByText('Order not found')).toBeTruthy();
  expect(screen.queryByLabelText('Try again')).toBeNull();
});

it('opens an order', async () => {
  await open();
  await fireEvent.press(await screen.findByLabelText(/^Order AZ-ORD100,/));
  await waitFor(() => expect(screen).toHavePathname('/orders/100'));
  expect(await screen.findByText('Order placed')).toBeTruthy();
});
