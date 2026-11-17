/** Cart screen: lines, quantities, totals, persistence and the check against the live catalogue. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { setApiBaseUrl } from '@/api/client';
import { CART_KEY } from '@/cart/CartProvider';
import type { CartItem } from '@/cart/cartReducer';

import { apiProduct, catalogHandler, lastSavedCart, mockFetch, productRequests, type ApiProduct } from './helpers';

const APP_DIR = 'src/app';
const MILK = apiProduct(1, { name: 'Olpers Milk', unit: '1 L', price: '320.00' });
const EGGS = apiProduct(2, { name: 'Farm Eggs', unit: '12 pcs', price: '390.50' });
const cartItem = (p: ApiProduct, quantity: number, price = Number(p.price)): CartItem => ({
  productId: p.id,
  name: p.name,
  unit: p.unit,
  price,
  image: p.image,
  quantity,
});

beforeEach(async () => {
  setApiBaseUrl('http://test.local/api');
  await AsyncStorage.clear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
});

async function openCart(items: CartItem[], catalogue: ApiProduct[] = [MILK, EGGS]) {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify({ items }));
  const calls = mockFetch(catalogHandler(catalogue));
  await renderRouter(APP_DIR, { initialUrl: '/cart' });
  return calls;
}
const checkoutButton = () => screen.getByLabelText(/^(Continue to checkout|Accept changes to continue)$/);
const isDisabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => !!el.props.accessibilityState?.disabled;

it('shows an empty cart', async () => {
  await openCart([]);
  expect(await screen.findByText('Your cart is empty')).toBeTruthy();
  expect(screen.getByLabelText('Start shopping')).toBeTruthy();
});

it('lists saved items with line totals and a subtotal, then checks them against the catalogue', async () => {
  const calls = await openCart([cartItem(MILK, 2), cartItem(EGGS, 1)]);

  expect(await screen.findByText('Olpers Milk')).toBeTruthy();
  expect(screen.getByText('3 items')).toBeTruthy();
  expect(screen.getByText('1 L · Rs. 320 each')).toBeTruthy();
  expect(screen.getByLabelText('Line total Rs. 640')).toBeTruthy();
  expect(screen.getByLabelText('Subtotal Rs. 1,030.50')).toBeTruthy();

  expect(await screen.findByText('Prices and availability checked just now.')).toBeTruthy();
  expect(isDisabled(checkoutButton())).toBe(false);
  expect(productRequests(calls).sort()).toEqual(['/catalog/products/1/', '/catalog/products/2/']);
});

it('increases, decreases and removes items, saving each change', async () => {
  await openCart([cartItem(MILK, 2), cartItem(EGGS, 1)]);
  await screen.findByText('Prices and availability checked just now.');

  const milkStepper = screen.getByLabelText('Olpers Milk quantity');
  await fireEvent.press(within(milkStepper).getByTestId('quantity-increase'));
  expect(await screen.findByLabelText('Subtotal Rs. 1,350.50')).toBeTruthy();
  await fireEvent.press(within(milkStepper).getByTestId('quantity-decrease'));
  await fireEvent.press(within(milkStepper).getByTestId('quantity-decrease'));
  expect(await screen.findByLabelText('Subtotal Rs. 710.50')).toBeTruthy();
  expect(milkStepper.props.accessibilityValue.now).toBe(1);

  await fireEvent.press(screen.getByLabelText('Remove Farm Eggs'));
  expect(await screen.findByLabelText('Subtotal Rs. 320')).toBeTruthy();
  expect(screen.queryByText('Farm Eggs')).toBeNull();
  await waitFor(() => expect(lastSavedCart(CART_KEY)).toEqual([cartItem(MILK, 1)]));
});

it('clears the cart after confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await openCart([cartItem(MILK, 2)]);
  await fireEvent.press(await screen.findByLabelText('Clear cart'));

  const buttons = alert.mock.calls[0][2]!;
  expect(alert.mock.calls[0][0]).toBe('Clear your cart?');
  await fireEvent.press(screen.getByLabelText('Olpers Milk quantity')); // nothing cleared until confirmed
  expect(screen.getByText('Olpers Milk')).toBeTruthy();

  await act(() => buttons.find((b) => b.style === 'destructive')!.onPress!());
  expect(await screen.findByText('Your cart is empty')).toBeTruthy();
  await waitFor(() => expect(lastSavedCart(CART_KEY)).toEqual([]));
  alert.mockRestore();
});

it('finds a changed price, blocks checkout until accepted, then uses the new price', async () => {
  await openCart([cartItem(MILK, 2, 300), cartItem(EGGS, 1)]);

  expect(await screen.findByText('Some items have changed')).toBeTruthy();
  expect(screen.getByText('• Olpers Milk is now Rs. 320 (was Rs. 300).')).toBeTruthy();
  expect(screen.getByText('Price changed')).toBeTruthy();
  expect(screen.getByLabelText('Subtotal Rs. 990.50')).toBeTruthy(); // still the old estimate
  expect(isDisabled(checkoutButton())).toBe(true);

  await fireEvent.press(screen.getByLabelText('Accept changes'));
  expect(await screen.findByText('Prices and availability checked just now.')).toBeTruthy();
  expect(screen.getByLabelText('Subtotal Rs. 1,030.50')).toBeTruthy();
  expect(isDisabled(checkoutButton())).toBe(false);
  await waitFor(() => expect((lastSavedCart(CART_KEY) ?? [])[0].price).toBe(320));
});

it('finds products that are gone or out of stock and removes them when accepted', async () => {
  const soldOut = apiProduct(3, { name: 'Basmati Rice', price: '1800.00', inStock: false, stockStatus: 'out' });
  const gone = cartItem(apiProduct(4, { name: 'Old Biscuits', price: '50.00' }), 1);
  await openCart([cartItem(MILK, 1), cartItem(soldOut, 1), gone], [MILK, soldOut]);

  expect(await screen.findByText('• Basmati Rice is out of stock and will be removed.')).toBeTruthy();
  expect(screen.getByText('• Old Biscuits is no longer sold and will be removed.')).toBeTruthy();
  expect(screen.getByText('No longer available')).toBeTruthy();
  expect(isDisabled(checkoutButton())).toBe(true);

  await fireEvent.press(screen.getByLabelText('Accept changes'));
  expect(await screen.findByText('Prices and availability checked just now.')).toBeTruthy();
  expect(screen.queryByText('Basmati Rice')).toBeNull();
  expect(screen.queryByText('Old Biscuits')).toBeNull();
  await waitFor(() => expect((lastSavedCart(CART_KEY) ?? []).map((i) => i.productId)).toEqual([1]));
});

it('mentions low stock without promising it', async () => {
  await openCart([cartItem(MILK, 1)], [{ ...MILK, stockStatus: 'low' }]);
  expect(await screen.findByText('Only a few left: Olpers Milk. Stock is confirmed when you place your order.')).toBeTruthy();
  expect(isDisabled(checkoutButton())).toBe(false);
});

it('keeps the cart usable offline but does not offer checkout until it can be checked', async () => {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify({ items: [cartItem(MILK, 2)] }));
  mockFetch(() => {
    throw new TypeError('Network request failed');
  });
  await renderRouter(APP_DIR, { initialUrl: '/cart' });

  expect(await screen.findByText('Olpers Milk')).toBeTruthy();
  expect(screen.getByLabelText('Subtotal Rs. 640')).toBeTruthy();
  expect(await screen.findByText("You're offline", {}, { timeout: 8000 })).toBeTruthy();
  expect(isDisabled(checkoutButton())).toBe(true);

  await fireEvent.press(within(screen.getByLabelText('Olpers Milk quantity')).getByTestId('quantity-increase'));
  expect(await screen.findByLabelText('Subtotal Rs. 960')).toBeTruthy();

  mockFetch(catalogHandler([MILK]));
  await fireEvent.press(screen.getByLabelText('Check again'));
  expect(await screen.findByText('Prices and availability checked just now.')).toBeTruthy();
  expect(isDisabled(checkoutButton())).toBe(false);
}, 20000);
