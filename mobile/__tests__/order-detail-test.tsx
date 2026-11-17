/** Order details and cancellation. */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { apiOrder, fakeShop, mockFetch, resetApp } from './helpers';

beforeEach(() => resetApp({ signedIn: true }));

async function open(order: Record<string, unknown>) {
  const shop = fakeShop({ orders: [order] });
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: `/orders/${order.id}` });
  return { shop, calls };
}

it('shows everything about the order', async () => {
  await open(
    apiOrder(5, {
      reference: 'AZ-FIVE',
      status: 'out_for_delivery',
      statusLabel: 'Out for delivery',
      canCancel: false,
      customerNote: 'Call at the gate',
      items: [
        { id: 1, productId: 12, productName: 'Olpers Milk', unit: '1 L', unitPrice: '320.00', quantity: 2, lineTotal: '640.00' },
        { id: 2, productId: 3, productName: 'Farm Eggs', unit: '12 pcs', unitPrice: '390.50', quantity: 1, lineTotal: '390.50' },
      ],
      subtotal: '1030.50',
      deliveryFee: '150.00',
      total: '1180.50',
      history: [
        { fromStatus: '', toStatus: 'pending', note: '', changedBy: 'You', createdAt: '2026-11-03T10:05:00+05:00' },
        { fromStatus: 'pending', toStatus: 'confirmed', note: '', changedBy: 'Store', createdAt: '2026-11-03T10:20:00+05:00' },
        { fromStatus: 'confirmed', toStatus: 'out_for_delivery', note: 'Rider: Bilal', changedBy: 'Store', createdAt: '2026-11-03T11:00:00+05:00' },
      ],
    }),
  );
  expect(await screen.findByText('AZ-FIVE')).toBeTruthy();
  expect(screen.getByLabelText('Status: Out for delivery')).toBeTruthy();
  expect(screen.getByText('1 L · 2 × Rs. 320')).toBeTruthy();
  expect(screen.getByText('12 pcs · 1 × Rs. 390.50')).toBeTruthy();
  expect(screen.getByLabelText('Subtotal Rs. 1,030.50')).toBeTruthy();
  expect(screen.getByLabelText('Delivery fee Rs. 150')).toBeTruthy();
  expect(screen.getByLabelText('Total Rs. 1,180.50')).toBeTruthy();
  expect(screen.getByText('House 12, Street 4, Gulberg, Lahore')).toBeTruthy();
  expect(screen.getByText('Your note: Call at the gate')).toBeTruthy();
  expect(screen.getByLabelText('Method Cash on Delivery')).toBeTruthy();
  expect(screen.getByLabelText('Status Pay on delivery')).toBeTruthy();
  expect(screen.getByText('Confirmed by the store')).toBeTruthy();
  expect(screen.getByText('Rider: Bilal')).toBeTruthy();
  expect(screen.queryByLabelText('Cancel order')).toBeNull(); // the server says it can't be cancelled
});

it('cancels a pending order only after confirmation, then shows the new status', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { calls, shop } = await open(apiOrder(6, { reference: 'AZ-SIX' }));
  await fireEvent.press(await screen.findByLabelText('Cancel order'));
  expect(alert.mock.calls[0][0]).toBe('Cancel this order?');
  expect(calls.some((c) => c.url.endsWith('/cancel/'))).toBe(false);

  await act(() => alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!());
  expect(await screen.findByLabelText('Status: Cancelled')).toBeTruthy();
  expect(screen.getByLabelText('Status Nothing to pay (cancelled)')).toBeTruthy();
  expect(screen.queryByLabelText('Cancel order')).toBeNull();
  expect(calls.filter((c) => c.url.endsWith('/customer/orders/6/cancel/'))).toHaveLength(1);
  expect(shop.state.orders[0].status).toBe('cancelled');
  alert.mockRestore();
});

it('explains when the store has already moved the order on', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { shop } = await open(apiOrder(8));
  await fireEvent.press(await screen.findByLabelText('Cancel order'));
  shop.state.orders[0].status = 'confirmed'; // confirmed by the store meanwhile
  shop.state.orders[0].statusLabel = 'Confirmed';
  shop.state.orders[0].canCancel = false;
  await act(() => alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!());
  expect(await screen.findByText('This order can no longer be cancelled online. Please contact the store.')).toBeTruthy();
  await waitFor(() => expect(screen.getByLabelText('Status: Confirmed')).toBeTruthy());
  alert.mockRestore();
});
