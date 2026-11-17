/**
 * Renders the real route tree in src/app with a scripted API, to check the
 * navigation structure, the Home screen states and the customer-only guard.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { setApiBaseUrl } from '@/api/client';
import { clearTokens, resetTokenCacheForTests, saveTokens } from '@/auth/tokenStorage';

import { API_CATEGORY, API_PRODUCT, CUSTOMER, jsonResponse, mockFetch, page } from './helpers';

// Resolved by expo-router against the working directory (the mobile/ project root).
const APP_DIR = 'src/app';

function catalogueApi({ products = [API_PRODUCT], fail = false } = {}) {
  return mockFetch((call) => {
    if (fail && call.url.includes('/catalog/products/')) throw new TypeError('Network request failed');
    if (call.url.includes('/catalog/categories/')) return jsonResponse(200, [API_CATEGORY]);
    if (/\/catalog\/products\/\d+\//.test(call.url)) return jsonResponse(200, API_PRODUCT);
    if (call.url.includes('/catalog/products/')) return jsonResponse(200, page(products));
    if (call.url.includes('/customer/profile/')) return jsonResponse(200, CUSTOMER);
    if (call.url.includes('/customer/addresses/')) return jsonResponse(200, []);
    if (call.url.includes('/customer/orders/')) return jsonResponse(200, page([]));
    return jsonResponse(404, {});
  });
}

beforeEach(async () => {
  setApiBaseUrl('http://test.local/api');
  await clearTokens();
  resetTokenCacheForTests();
  await AsyncStorage.clear();
});

describe('Home', () => {
  it('shows branding, categories and products from the API', async () => {
    const calls = catalogueApi();
    await renderRouter(APP_DIR, { initialUrl: '/' });

    expect(screen).toHavePathname('/');
    expect(screen.getByText('Al Zaryab')).toBeTruthy();
    expect(await screen.findByText('Olpers Milk')).toBeTruthy();
    expect(screen.getByText('Rs. 1,250.50')).toBeTruthy();
    expect(screen.getByText('Only a few left')).toBeTruthy();
    expect(await screen.findByText('Dairy & Eggs')).toBeTruthy();
    expect(screen.getByLabelText('Search products')).toBeTruthy();
    expect(calls.some((c) => c.url.includes('/catalog/products/?page_size=20'))).toBe(true);
  });

  it('shows an empty state when the store has no products', async () => {
    catalogueApi({ products: [] });
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('No products yet')).toBeTruthy();
  });

  it('shows an offline error with retry', async () => {
    catalogueApi({ fail: true });
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText("You're offline", {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  }, 15000);
});

describe('navigation', () => {
  it.each([
    ['/categories', 'Dairy & Eggs'],
    ['/search', 'Find a product'],
    ['/cart', 'Your cart is empty'],
    ['/category/Dairy%20%26%20Eggs', 'Olpers Milk'],
  ])('%s renders', async (url, text) => {
    catalogueApi();
    await renderRouter(APP_DIR, { initialUrl: url });
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('/login and /register show their forms', async () => {
    catalogueApi();
    await renderRouter(APP_DIR, { initialUrl: '/login' });
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });

  it('account tab invites signed-out visitors to sign in', async () => {
    catalogueApi();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText('Sign in to Al Zaryab')).toBeTruthy();
  });
});

describe('customer-only screens', () => {
  it.each(['/checkout', '/orders', '/addresses', '/orders/5'])('%s redirects signed-out visitors to sign in', async (url) => {
    catalogueApi();
    await renderRouter(APP_DIR, { initialUrl: url });
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });

  it('are open to a signed-in customer, and the sign-in screen is not', async () => {
    await saveTokens({ access: 'a', refresh: 'r' });
    resetTokenCacheForTests();
    catalogueApi();
    await renderRouter(APP_DIR, { initialUrl: '/orders' });
    expect(await screen.findByText('No orders yet')).toBeTruthy();
    expect(screen).toHavePathname('/orders');
  });

  it('account tab shows the signed-in customer', async () => {
    await saveTokens({ access: 'a', refresh: 'r' });
    resetTokenCacheForTests();
    catalogueApi();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText('Ali Raza')).toBeTruthy();
    expect(screen.getByText('All orders')).toBeTruthy();
    expect(screen.getByLabelText('Sign out')).toBeTruthy();
  });
});
