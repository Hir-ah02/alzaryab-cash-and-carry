/** The session ends at the moment of ordering: sign in again and come back to checkout, cart intact. */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { fakeShop, isDisabled, jsonResponse, lastSavedCart, mockFetch, resetApp, seedCart, TEST_PASSWORD } from './helpers';

it('sends the customer to sign in and back to checkout, without placing or losing anything', async () => {
  await resetApp({ signedIn: true });
  await seedCart([{ productId: 12, name: 'Olpers Milk', unit: '1 L', price: 1250.5, quantity: 2 }]);
  const shop = fakeShop();
  let expired = false;
  mockFetch((call) => {
    if (expired && call.url.includes('/customer/') && !call.url.includes('/auth/login/')) {
      return jsonResponse(401, { code: 'token_not_valid' }); // access and refresh tokens both rejected
    }
    return shop.handler(call);
  });
  await renderRouter('src/app', { initialUrl: '/checkout' });

  await waitFor(() => expect(isDisabled(screen.getByLabelText(/^Place order/))).toBe(false));
  expired = true;
  await fireEvent.press(screen.getByLabelText(/^Place order/));

  await waitFor(() => expect(screen).toHavePathname('/login'));
  expect(await screen.findByText('Your session has ended. Please sign in again.')).toBeTruthy();
  expect(shop.state.orders).toHaveLength(0);

  expired = false;
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'ali@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), TEST_PASSWORD);
  await fireEvent.press(screen.getByLabelText('Sign in'));
  await waitFor(() => expect(screen).toHavePathname('/checkout'));
  expect(await screen.findByLabelText('Total to pay on delivery Rs. 2,651')).toBeTruthy();
  expect(lastSavedCart('alzaryab.cart.v1') ?? [{ productId: 12, quantity: 2 }]).toEqual([expect.objectContaining({ productId: 12, quantity: 2 })]);
});
