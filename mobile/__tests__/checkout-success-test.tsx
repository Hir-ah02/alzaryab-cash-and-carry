/** A complete Cash on Delivery checkout, ending on the confirmation. Own file: it navigates. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { PENDING_KEY } from '@/checkout/checkoutStore';

import { ADDRESS, fakeShop, isDisabled, lastSavedCart, mockFetch, resetApp, seedCart } from './helpers';

it('places one order with the chosen address and note, then shows the confirmation and empties the cart', async () => {
  await resetApp({ signedIn: true });
  await seedCart([{ productId: 12, name: 'Olpers Milk', unit: '1 L', price: 1250.5, quantity: 2 }]);
  const shop = fakeShop({ addresses: [ADDRESS, { ...ADDRESS, id: 32, label: 'Work', line1: 'Office 5', isDefault: false }] });
  const calls = mockFetch(shop.handler);
  const app = await renderRouter('src/app', { initialUrl: '/checkout' });

  await fireEvent.press(await screen.findByRole('radio', { name: /Deliver to Work/ }));
  await fireEvent.changeText(screen.getByLabelText('Note (optional)'), ' Please call at the gate ');
  await waitFor(() => expect(isDisabled(screen.getByLabelText('Place order · Rs. 2,651'))).toBe(false));
  const button = screen.getByLabelText('Place order · Rs. 2,651');
  await Promise.all([fireEvent.press(button), fireEvent.press(button), fireEvent.press(button)]);

  await waitFor(() => expect(app.getPathname()).toMatch(/^\/orders\/\d+$/));
  expect(await screen.findByText('Thank you! Your order has been placed')).toBeTruthy();
  expect(screen.getByText(/Please have Rs\. 2,651 ready in cash when it arrives/)).toBeTruthy();

  const posts = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/customer/orders/'));
  expect(posts).toHaveLength(1);
  expect(posts[0].body).toEqual({
    items: [{ productId: 12, quantity: 2 }],
    addressId: 32,
    note: 'Please call at the gate',
    paymentMethod: 'cash_on_delivery',
    requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });
  expect(shop.state.orders).toHaveLength(1);
  expect(shop.state.stock[12]).toBe(48);
  await waitFor(() => expect(lastSavedCart('alzaryab.cart.v1')).toEqual([]));
  expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
});
