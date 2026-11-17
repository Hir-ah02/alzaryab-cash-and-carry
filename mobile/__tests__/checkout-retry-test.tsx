/**
 * The order reaches the server but the answer is lost. Trying again sends the
 * same requestId, and the server returns that same order: one order, not two.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { PENDING_KEY } from '@/checkout/checkoutStore';

import { fakeShop, isDisabled, lastSavedCart, mockFetch, resetApp, seedCart } from './helpers';

it('retries an unconfirmed order with the same request id and never creates a duplicate', async () => {
  await resetApp({ signedIn: true });
  await seedCart([{ productId: 12, name: 'Olpers Milk', unit: '1 L', price: 1250.5, quantity: 2 }]);
  const shop = fakeShop();
  let loseNextAnswer = true;
  const calls = mockFetch((call) => {
    if (call.method === 'POST' && call.url.endsWith('/customer/orders/') && loseNextAnswer) {
      loseNextAnswer = false;
      shop.handler(call); // the server creates the order…
      throw new TypeError('Network request failed'); // …but the answer never arrives
    }
    return shop.handler(call);
  });
  const app = await renderRouter('src/app', { initialUrl: '/checkout' });

  await waitFor(() => expect(isDisabled(screen.getByLabelText(/^Place order/))).toBe(false));
  await fireEvent.press(screen.getByLabelText(/^Place order/));
  expect(await screen.findByText("We couldn't confirm your order")).toBeTruthy();
  expect(shop.state.orders).toHaveLength(1);
  expect(lastSavedCart('alzaryab.cart.v1')).toEqual([expect.objectContaining({ productId: 12, quantity: 2 })]);

  await fireEvent.press(screen.getByLabelText('Try again'));
  await waitFor(() => expect(app.getPathname()).toMatch(/^\/orders\/\d+$/));
  expect(await screen.findByText('Thank you! Your order has been placed')).toBeTruthy();

  const posts = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/customer/orders/'));
  expect(posts).toHaveLength(2);
  expect(posts[1].body).toEqual(posts[0].body); // identical, including requestId
  expect(shop.state.orders).toHaveLength(1);
  expect(shop.state.stock[12]).toBe(48);
  await waitFor(() => expect(lastSavedCart('alzaryab.cart.v1')).toEqual([]));
  expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
});
