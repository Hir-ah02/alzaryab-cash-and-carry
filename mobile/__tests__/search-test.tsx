/** Search screen against a fake catalogue that filters and pages like Django. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { setApiBaseUrl } from '@/api/client';

import { apiProduct, catalogHandler, mockFetch, productRequests, type FetchCall } from './helpers';

const APP_DIR = 'src/app';
const CATALOGUE = [
  apiProduct(1, { name: 'Olpers Milk', price: '320.00' }),
  apiProduct(2, { name: 'Milkpak Cream', price: '210.00' }),
  apiProduct(3, { name: 'Basmati Rice', price: '1800.00', inStock: false, stockStatus: 'out' }),
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** renderRouter switches Jest to fake timers: move the clock instead of sleeping. */
const elapse = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const searches = (calls: FetchCall[]) => productRequests(calls).filter((url) => url.includes('search='));

beforeEach(async () => {
  setApiBaseUrl('http://test.local/api');
  await AsyncStorage.clear();
});

async function openSearch(products = CATALOGUE) {
  const calls = mockFetch(catalogHandler(products));
  await renderRouter(APP_DIR, { initialUrl: '/search' });
  return { calls, input: await screen.findByLabelText('Search products') };
}

it('waits for typing to pause, then sends one request for the final text', async () => {
  const { calls, input } = await openSearch();
  for (const text of ['m', 'mi', 'mil', 'milk']) await fireEvent.changeText(input, text);

  expect(await screen.findByText('Olpers Milk')).toBeTruthy();
  expect(screen.getByText('Milkpak Cream')).toBeTruthy();
  expect(screen.queryByText('Basmati Rice')).toBeNull();
  expect(screen.getByText('2 results for “milk”')).toBeTruthy();
  expect(searches(calls)).toEqual(['/catalog/products/?search=milk&page_size=20']);
});

it('does not search for a single letter', async () => {
  const { calls, input } = await openSearch();
  await fireEvent.changeText(input, 'm');
  expect(await screen.findByText('Keep typing')).toBeTruthy();
  await elapse(500);
  expect(searches(calls)).toEqual([]);
});

it('reuses cached results when the same search is typed again', async () => {
  const { calls, input } = await openSearch();
  await fireEvent.changeText(input, 'rice');
  expect(await screen.findByText('Basmati Rice')).toBeTruthy();
  expect(screen.getByText('Out of stock')).toBeTruthy();
  await fireEvent.changeText(input, '');
  await fireEvent.changeText(input, 'Rice ');
  await elapse(500);
  expect(screen.getByText('Basmati Rice')).toBeTruthy();
  expect(searches(calls)).toHaveLength(1);
});

it('shows a no-results state', async () => {
  const { input } = await openSearch();
  await fireEvent.changeText(input, 'zzz');
  expect(await screen.findByText('No products match “zzz”')).toBeTruthy();
  expect(screen.getByText('Check the spelling, or try a shorter word.')).toBeTruthy();
});

it('clears the search', async () => {
  const { input } = await openSearch();
  await fireEvent.changeText(input, 'milk');
  expect(await screen.findByText('Olpers Milk')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Clear search'));
  expect(await screen.findByText('Find a product')).toBeTruthy();
  expect(screen.getByLabelText('Search products').props.value).toBe('');
  expect(screen.queryByText('Olpers Milk')).toBeNull();
});

it('loads the next page of results when scrolled to the end', async () => {
  const many = Array.from({ length: 25 }, (_, i) => apiProduct(i + 1, { name: `Milk ${String(i + 1).padStart(2, '0')}` }));
  const { calls, input } = await openSearch(many);
  await fireEvent.changeText(input, 'milk');
  expect(await screen.findByText('25 results for “milk”')).toBeTruthy();

  await fireEvent(screen.getByLabelText('Search results'), 'onEndReached');
  expect(await screen.findByText('That’s all 25 products')).toBeTruthy();
  expect(searches(calls)).toEqual(['/catalog/products/?search=milk&page_size=20', '/catalog/products/?search=milk&page=2&page_size=20']);
});

it('explains network errors and offers to retry', async () => {
  const { input } = await openSearch();
  mockFetch(() => {
    throw new TypeError('Network request failed');
  });
  await fireEvent.changeText(input, 'milk');
  expect(await screen.findByText("You're offline", {}, { timeout: 8000 })).toBeTruthy();
  expect(screen.getByLabelText('Try again')).toBeTruthy();
}, 15000);

it('cancels a search that is replaced before it finishes', async () => {
  const signals: AbortSignal[] = [];
  const handler = catalogHandler(CATALOGUE);
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    signals.push(init.signal!);
    if (String(input).includes('search=milk')) await wait(400); // slow
    return handler({ url: String(input), method: 'GET', headers: {}, body: undefined });
  }) as typeof fetch;
  await renderRouter(APP_DIR, { initialUrl: '/search' });
  const input = await screen.findByLabelText('Search products');

  await fireEvent.changeText(input, 'milk');
  await waitFor(() => expect(signals).toHaveLength(1), { timeout: 1000 });
  await fireEvent.changeText(input, 'rice');
  expect(await screen.findByText('Basmati Rice')).toBeTruthy();
  expect(signals[0].aborted).toBe(true);
});
