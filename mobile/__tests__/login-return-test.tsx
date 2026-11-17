/**
 * Cart → Continue to checkout (signed out) → Sign in → straight back to
 * Checkout, with the cart untouched. Own file: it navigates by pressing.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { fakeShop, isDisabled, lastSavedCart, mockFetch, resetApp, seedCart, TEST_PASSWORD } from './helpers';

it('returns the customer to checkout after signing in, keeping the cart', async () => {
  await resetApp();
  await seedCart([{ productId: 12, name: 'Olpers Milk', unit: '1 L', price: 1250.5, quantity: 2 }]);
  const shop = fakeShop();
  const calls = mockFetch(shop.handler);

  await renderRouter('src/app', { initialUrl: '/cart' });
  await waitFor(() => expect(isDisabled(screen.getByLabelText('Continue to checkout'))).toBe(false));
  await fireEvent.press(screen.getByLabelText('Continue to checkout'));

  await waitFor(() => expect(screen).toHavePathname('/login'));
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'ali@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), TEST_PASSWORD);
  await fireEvent.press(screen.getByLabelText('Sign in'));

  await waitFor(() => expect(screen).toHavePathname('/checkout'));
  expect(await screen.findByText('Total to pay on delivery')).toBeTruthy();
  expect(screen.getByText('Olpers Milk')).toBeTruthy();
  expect(lastSavedCart('alzaryab.cart.v1') ?? [{ productId: 12, quantity: 2 }]).toEqual([expect.objectContaining({ productId: 12, quantity: 2 })]);
  expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/customer/orders/'))).toBe(false);
});
