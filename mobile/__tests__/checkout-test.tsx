/**
 * Checkout before an order is accepted: server totals, readiness rules,
 * problems and failures. Tests that end on the confirmation screen live in
 * checkout-success-test / checkout-retry-test (navigation must be last in a file).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { PENDING_KEY } from '@/checkout/checkoutStore';

import { ADDRESS, fakeShop, isDisabled, jsonResponse, lastSavedCart, mockFetch, resetApp, seedCart, type FakeShopOptions } from './helpers';

const MILK = { productId: 12, name: 'Olpers Milk', unit: '1 L', price: 1250.5, quantity: 2 };
const placeButton = () => screen.getByLabelText(/^Place order/);
const orderPosts = (calls: { method: string; url: string }[]) => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/customer/orders/'));

beforeEach(() => resetApp({ signedIn: true }));

async function openCheckout(options: FakeShopOptions = {}, cart = [MILK]) {
  await seedCart(cart);
  const shop = fakeShop(options);
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/checkout' });
  return { shop, calls };
}

it('shows the server’s subtotal, delivery fee and total, Cash on Delivery and the default address', async () => {
  const { calls } = await openCheckout();
  expect(await screen.findByLabelText('Total to pay on delivery Rs. 2,651')).toBeTruthy();
  expect(screen.getByLabelText('Subtotal Rs. 2,501')).toBeTruthy();
  expect(screen.getByLabelText('Delivery fee Rs. 150')).toBeTruthy();
  expect(screen.getByText('Cash on Delivery')).toBeTruthy();
  expect(screen.getByText('1 L · 2 × Rs. 1,250.50')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /Deliver to Home/ }).props.accessibilityState.checked).toBe(true);
  await waitFor(() => expect(isDisabled(placeButton())).toBe(false));
  expect(placeButton().props.accessibilityLabel).toBe('Place order · Rs. 2,651');
  expect(calls.find((c) => c.url.endsWith('/customer/orders/quote/'))?.body).toEqual({ items: [{ productId: 12, quantity: 2 }] });
});

it('shows free delivery when the server applies it', async () => {
  await openCheckout({ freeDeliveryFrom: '2000.00' });
  expect(await screen.findByLabelText('Delivery fee Free')).toBeTruthy();
  expect(screen.getByLabelText('Total to pay on delivery Rs. 2,501')).toBeTruthy();
});

it('reports a stock shortage before ordering and offers the quantity that is left', async () => {
  await openCheckout({ stock: { 12: 1 } });
  expect(await screen.findByText('Olpers Milk: Only 1 left in stock.')).toBeTruthy();
  expect(isDisabled(placeButton())).toBe(true);
  await fireEvent.press(screen.getByLabelText('Change to 1'));
  expect(await screen.findByLabelText('Total to pay on delivery Rs. 1,400.50')).toBeTruthy();
  await waitFor(() => expect(isDisabled(placeButton())).toBe(false));
});

it('needs a delivery address', async () => {
  await openCheckout({ addresses: [] });
  expect(await screen.findByLabelText('Add a delivery address')).toBeTruthy();
  expect(screen.getByText('Add a delivery address to place your order.')).toBeTruthy();
  await screen.findByLabelText('Total to pay on delivery Rs. 2,651');
  expect(isDisabled(placeButton())).toBe(true);
});

it('needs changed prices to be accepted first', async () => {
  await openCheckout({}, [{ ...MILK, price: 1200 }]);
  expect(await screen.findByText('• Olpers Milk is now Rs. 1,250.50 (was Rs. 1,200).')).toBeTruthy();
  expect(isDisabled(placeButton())).toBe(true);
  await fireEvent.press(screen.getByLabelText('Accept changes'));
  await waitFor(() => expect(isDisabled(placeButton())).toBe(false));
});

it('does not offer checkout for an empty cart', async () => {
  await openCheckout({}, []);
  expect(await screen.findByText('Your cart is empty')).toBeTruthy();
});

it('keeps the cart and explains when the server refuses the order', async () => {
  const { shop, calls } = await openCheckout();
  await waitFor(() => expect(isDisabled(placeButton())).toBe(false));
  // Someone else bought the last ones between the quote and the order.
  shop.state.intercept = (call) =>
    call.method === 'POST' && call.url.endsWith('/customer/orders/')
      ? jsonResponse(400, { detail: 'Some items in your order need attention.', items: [{ productId: 12, message: 'This product is out of stock.', available: 0 }] })
      : undefined;
  await fireEvent.press(placeButton());

  expect(await screen.findByText("Your order wasn't placed")).toBeTruthy();
  expect(screen.getByText('Some items changed while you were checking out. Review them below. Your cart is unchanged.')).toBeTruthy();
  expect(orderPosts(calls)).toHaveLength(1);
  expect(shop.state.orders).toHaveLength(0);
  expect(lastSavedCart('alzaryab.cart.v1')).toEqual([expect.objectContaining({ productId: 12, quantity: 2 })]);
  expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull(); // nothing to retry: no order exists
});

it('explains an address the server rejects', async () => {
  const { shop } = await openCheckout();
  await waitFor(() => expect(isDisabled(placeButton())).toBe(false));
  shop.state.intercept = (call) =>
    call.method === 'POST' && call.url.endsWith('/customer/orders/') ? jsonResponse(400, { addressId: ['Choose one of your saved addresses.'] }) : undefined;
  await fireEvent.press(placeButton());
  expect(await screen.findByText('Choose one of your saved addresses. Your cart is unchanged.')).toBeTruthy();
});

it('asks again when the total changed since it was shown', async () => {
  const { shop, calls } = await openCheckout();
  await waitFor(() => expect(isDisabled(placeButton())).toBe(false));
  shop.state.deliveryFee = 200;
  await fireEvent.press(placeButton());
  expect(await screen.findByText('The total is now Rs. 2,701. Check the summary below and tap Place order again.')).toBeTruthy();
  expect(orderPosts(calls)).toHaveLength(0);
  expect(screen.getByLabelText('Total to pay on delivery Rs. 2,701')).toBeTruthy();
});

it('keeps the request id and the cart when the answer is lost, and offers to try again', async () => {
  const { shop } = await openCheckout();
  await waitFor(() => expect(isDisabled(placeButton())).toBe(false));
  shop.state.intercept = (call) => {
    if (call.method === 'POST' && call.url.endsWith('/customer/orders/')) throw new TypeError('Network request failed');
    return undefined;
  };
  await fireEvent.press(placeButton());

  expect(await screen.findByText("We couldn't confirm your order")).toBeTruthy();
  expect(screen.getByText(/may already have been received\. Tap Try again: if it went through you'll see that same order, never a second one\. Your cart is unchanged\./)).toBeTruthy();
  const pending = JSON.parse((await AsyncStorage.getItem(PENDING_KEY))!);
  expect(pending).toMatchObject({ items: [{ productId: 12, quantity: 2 }], addressId: ADDRESS.id, total: 2651 });
  expect(pending.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(lastSavedCart('alzaryab.cart.v1')).toEqual([expect.objectContaining({ productId: 12, quantity: 2 })]);
  expect(shop.state.orders).toHaveLength(0);
});

it('after a restart, offers to finish an unconfirmed order, or start over after a warning', async () => {
  await AsyncStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ requestId: '6f1c9a4e-2b7d-4c1e-9f3a-8d2e5b7c1a90', items: [{ productId: 12, quantity: 2 }], addressId: 31, note: '', total: 2651, createdAt: '' }),
  );
  const alert = jest.spyOn(Alert, 'alert');
  await openCheckout();
  expect(await screen.findByText(/Your order of 2 items \(Rs\. 2,651\) may already have been received/)).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Start a new order instead'));
  expect(alert.mock.calls[0][1]).toMatch(/already in My orders/);
  await act(() => alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!());
  expect(await screen.findByLabelText('Total to pay on delivery Rs. 2,651')).toBeTruthy();
  expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
  alert.mockRestore();
});
