/** Categories tab and category product lists. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { setApiBaseUrl } from '@/api/client';

import { apiProduct, catalogHandler, mockFetch, productRequests } from './helpers';

const APP_DIR = 'src/app';
const CATEGORIES = [
  { id: 2, name: 'Dairy & Eggs', description: '', productCount: 2 },
  { id: 5, name: 'Snacks', description: '', productCount: 1 },
];
const CATALOGUE = [
  apiProduct(1, { name: 'Olpers Milk', category: 'Dairy & Eggs', categoryId: 2 }),
  apiProduct(2, { name: 'Farm Eggs', category: 'Dairy & Eggs', categoryId: 2 }),
  apiProduct(3, { name: 'Lays Chips', category: 'Snacks', categoryId: 5 }),
];

beforeEach(async () => {
  setApiBaseUrl('http://test.local/api');
  await AsyncStorage.clear();
});

it('lists categories with product counts', async () => {
  mockFetch(catalogHandler(CATALOGUE, CATEGORIES));
  await renderRouter(APP_DIR, { initialUrl: '/categories' });
  expect(await screen.findByLabelText('Dairy & Eggs, 2 products')).toBeTruthy();
  expect(screen.getByText('1 product')).toBeTruthy();
});

it('shows only the products of the chosen category, asking the server by name', async () => {
  const calls = mockFetch(catalogHandler(CATALOGUE, CATEGORIES));
  await renderRouter(APP_DIR, { initialUrl: '/category/Dairy%20%26%20Eggs' });

  expect(await screen.findByText('Olpers Milk')).toBeTruthy();
  expect(screen.getByText('Farm Eggs')).toBeTruthy();
  expect(screen.queryByText('Lays Chips')).toBeNull();
  expect(screen.getByText('2 products')).toBeTruthy();

  const request = new URL(`http://x${productRequests(calls)[0]}`);
  expect(request.searchParams.get('category')).toBe('Dairy & Eggs');
});

it('pages through a large category', async () => {
  const snacks = Array.from({ length: 30 }, (_, i) => apiProduct(i + 1, { name: `Snack ${String(i + 1).padStart(2, '0')}`, category: 'Snacks' }));
  const calls = mockFetch(catalogHandler(snacks, CATEGORIES));
  await renderRouter(APP_DIR, { initialUrl: '/category/Snacks' });
  expect(await screen.findByText('30 products')).toBeTruthy();
  await fireEvent(screen.getByLabelText('Snacks products'), 'onEndReached');
  expect(await screen.findByText('That’s all 30 products')).toBeTruthy();
  expect(productRequests(calls)).toContain('/catalog/products/?category=Snacks&page=2&page_size=20');
});

it('explains an empty category', async () => {
  mockFetch(catalogHandler(CATALOGUE, CATEGORIES));
  await renderRouter(APP_DIR, { initialUrl: '/category/Frozen' });
  expect(await screen.findByText('Nothing in Frozen right now')).toBeTruthy();
  expect(screen.getByLabelText('Browse all products')).toBeTruthy();
});

it('shows an error with retry when the list fails', async () => {
  mockFetch(() => {
    throw new TypeError('Network request failed');
  });
  await renderRouter(APP_DIR, { initialUrl: '/category/Snacks' });
  expect(await screen.findByText("You're offline", {}, { timeout: 8000 })).toBeTruthy();
  expect(screen.getByLabelText('Try again')).toBeTruthy();
}, 15000);
