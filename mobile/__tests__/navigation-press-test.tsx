/**
 * Tapping through the app. Kept in its own file: expo-router keeps navigation
 * state in module scope, and Jest gives each file a fresh module registry.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { setApiBaseUrl } from '@/api/client';

import { API_CATEGORY, API_PRODUCT, jsonResponse, mockFetch, page } from './helpers';

// Resolved by expo-router against the working directory (the mobile/ project root).
const APP_DIR = 'src/app';

it('opens product details from a product on Home', async () => {
  setApiBaseUrl('http://test.local/api');
  const calls = mockFetch((call) => {
    if (call.url.includes('/catalog/categories/')) return jsonResponse(200, [API_CATEGORY]);
    if (/\/catalog\/products\/\d+\//.test(call.url)) return jsonResponse(200, API_PRODUCT);
    return jsonResponse(200, page([API_PRODUCT]));
  });

  await renderRouter(APP_DIR, { initialUrl: '/' });
  await fireEvent.press(await screen.findByLabelText(/Olpers Milk, 1 L/));

  await waitFor(() => expect(screen).toHavePathname('/product/12'));
  expect(await screen.findByText('Full cream milk')).toBeTruthy();
  expect(screen.getByLabelText('Add to cart')).toBeTruthy();
  expect(calls.some((c) => c.url.endsWith('/catalog/products/12/'))).toBe(true);
});
