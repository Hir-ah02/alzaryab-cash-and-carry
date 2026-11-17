/** Product page: details, quantity, Add to cart, stock rules and feedback. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { setApiBaseUrl } from '@/api/client';
import { CART_KEY } from '@/cart/CartProvider';

import { API_PRODUCT, apiProduct, catalogHandler, lastSavedCart, mockFetch } from './helpers';

const APP_DIR = 'src/app';
const RICE = apiProduct(3, { name: 'Basmati Rice', unit: '5 kg', price: '1800.00', inStock: false, stockStatus: 'out' });

beforeEach(async () => {
  setApiBaseUrl('http://test.local/api');
  await AsyncStorage.clear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
  mockFetch(catalogHandler([API_PRODUCT, RICE]));
});

async function savedCart() {
  return JSON.parse((await AsyncStorage.getItem(CART_KEY)) ?? '{"items":[]}').items as { productId: number; quantity: number; price: number }[];
}
const quantity = () => screen.getByLabelText('Quantity').props.accessibilityValue.now as number;

it('shows the product details', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/product/12' });
  expect(await screen.findByText('Full cream milk')).toBeTruthy();
  expect(screen.getAllByText('Olpers Milk').length).toBeGreaterThan(0);
  expect(screen.getByText('DAIRY & EGGS')).toBeTruthy();
  expect(screen.getByText('1 L')).toBeTruthy();
  expect(screen.getByText('Rs. 1,250.50')).toBeTruthy();
  expect(screen.getByText('Only a few left')).toBeTruthy();
  expect(screen.getByText(/The store confirms stock and the final price when you place your order/)).toBeTruthy();
  expect(quantity()).toBe(1);
});

it('adds the chosen quantity to the cart and confirms it', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/product/12' });
  await screen.findByText('Full cream milk');

  await fireEvent.press(screen.getByTestId('quantity-decrease')); // can't go below 1
  expect(quantity()).toBe(1);
  await fireEvent.press(screen.getByTestId('quantity-increase'));
  await fireEvent.press(screen.getByTestId('quantity-increase'));
  expect(quantity()).toBe(3);

  await fireEvent.press(screen.getByLabelText('Add to cart'));
  expect(await screen.findByText('Added 3 × Olpers Milk to your cart.')).toBeTruthy();
  expect(screen.getByText('In your cart: 3')).toBeTruthy();
  expect(quantity()).toBe(1);
  await waitFor(() => expect(lastSavedCart(CART_KEY)).toEqual([expect.objectContaining({ productId: 12, quantity: 3, price: 1250.5 })]));

  await fireEvent.press(screen.getByLabelText('Add to cart'));
  expect(await screen.findByText('In your cart: 4')).toBeTruthy();
});

it('supports the screen-reader adjust gesture with the same limits', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/product/12' });
  await screen.findByText('Full cream milk');
  const stepper = screen.getByLabelText('Quantity');
  await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(quantity()).toBe(1);
  await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(quantity()).toBe(2);
});

it('does not let out-of-stock products be added', async () => {
  await renderRouter(APP_DIR, { initialUrl: '/product/3' });
  expect(await screen.findAllByText('Out of stock')).toHaveLength(2); // badge and button
  const button = screen.getByLabelText('Out of stock');
  expect(button.props.accessibilityState.disabled).toBe(true);
  expect(screen.queryByLabelText('Quantity')).toBeNull();
  await fireEvent.press(button);
  expect(await savedCart()).toEqual([]);
});

it('stops at the per-product limit', async () => {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify({ items: [{ productId: 12, name: 'Olpers Milk', unit: '1 L', price: 1250.5, image: null, quantity: 99 }] }));
  await renderRouter(APP_DIR, { initialUrl: '/product/12' });
  expect(await screen.findByText('In your cart: 99')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('quantity-increase')); // only 1 more allowed
  expect(quantity()).toBe(1);
  await fireEvent.press(screen.getByLabelText('Add to cart'));
  expect(await screen.findByText('In your cart: 100')).toBeTruthy();
  expect(screen.getByLabelText('Cart limit reached').props.accessibilityState.disabled).toBe(true);
});

it('explains a product that is no longer on sale and lets it be removed from the cart', async () => {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify({ items: [{ productId: 99, name: 'Old Biscuits', unit: '1 pack', price: 50, image: null, quantity: 2 }] }));
  await renderRouter(APP_DIR, { initialUrl: '/product/99' });
  expect(await screen.findByText('This product is no longer available')).toBeTruthy();
  expect(screen.queryByLabelText('Try again')).toBeNull();
  await fireEvent.press(await screen.findByLabelText('Remove it from my cart'));
  await waitFor(() => expect(lastSavedCart(CART_KEY)).toEqual([]));
});
