/** Account tab for a signed-in customer: profile, address, recent orders, sign out. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { ADDRESS, apiOrder, fakeShop, jsonResponse, mockFetch, resetApp, seedCart } from './helpers';

beforeEach(() => resetApp({ signedIn: true }));

it('shows the profile, default address and recent orders', async () => {
  const shop = fakeShop({
    addresses: [ADDRESS, { ...ADDRESS, id: 32, label: 'Work', isDefault: false }],
    orders: [apiOrder(7, { reference: 'AZ-SEVEN', status: 'out_for_delivery', statusLabel: 'Out for delivery' }), apiOrder(6), apiOrder(5), apiOrder(4)],
  });
  mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/account' });

  expect(await screen.findByText('Ali Raza')).toBeTruthy();
  expect(screen.getByText('ali@example.com')).toBeTruthy();
  expect(screen.getByText('03001112233')).toBeTruthy();
  expect(screen.getByText(/Customer since/)).toBeTruthy();
  expect(await screen.findByText('Home · Ali Raza')).toBeTruthy();
  expect(screen.getByText('+1 more saved')).toBeTruthy();
  expect(await screen.findByText('AZ-SEVEN')).toBeTruthy();
  expect(screen.getByText('Out for delivery')).toBeTruthy();
  expect(screen.queryByText('AZ-TEST0004')).toBeNull(); // only the latest 3
});

it('has empty and error states for its sections', async () => {
  const shop = fakeShop({ addresses: [] });
  shop.state.intercept = (call) => (call.url.includes('/customer/orders/') ? jsonResponse(500, {}) : undefined);
  mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/account' });
  expect(await screen.findByText('No saved addresses yet.')).toBeTruthy();
  expect(await screen.findByText("Couldn't load your orders.", {}, { timeout: 8000 })).toBeTruthy();

  shop.state.intercept = null;
  await fireEvent.press(screen.getByLabelText('Try again'));
  expect(await screen.findByText('No orders yet. Your orders will appear here.')).toBeTruthy();
}, 15000);

it('signs out: tokens and profile are removed, the cart stays', async () => {
  await seedCart([{ productId: 12, name: 'Olpers Milk', unit: '1 L', price: 1250.5, quantity: 2 }]);
  const shop = fakeShop();
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/account' });
  await fireEvent.press(await screen.findByLabelText('Sign out'));

  expect(await screen.findByText('Sign in to Al Zaryab')).toBeTruthy();
  expect(await SecureStore.getItemAsync('alzaryab.customer.access')).toBeNull();
  expect(await AsyncStorage.getItem('alzaryab.customer.profile')).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem('alzaryab.cart.v1'))!).items).toHaveLength(1);
  await waitFor(() => expect(calls.find((c) => c.url.endsWith('/customer/auth/logout/'))?.body).toEqual({ refresh: 'refresh-1' }));
});
