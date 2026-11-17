import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { setApiBaseUrl } from '@/api/client';
import { PRODUCT_PAGE_SIZE, productListKey, useProductPages } from '@/hooks/useCatalog';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { createQueryClient } from '@/lib/queryClient';

import { apiProduct, catalogHandler, mockFetch, productRequests } from './helpers';

const PRODUCTS = Array.from({ length: 45 }, (_, i) => apiProduct(i + 1, { category: i % 3 === 0 ? 'Snacks' : 'Dairy & Eggs' }));

let client = createQueryClient();
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  setApiBaseUrl('http://test.local/api');
  client = createQueryClient(); // a fresh cache per test
});

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits until the value stops changing; flush applies it at once', async () => {
    const { result, rerender } = await renderHook(({ value }: { value: string }) => useDebouncedValue(value, 300), { initialProps: { value: 'm' } });
    await rerender({ value: 'mi' });
    await act(() => jest.advanceTimersByTime(200));
    await rerender({ value: 'mil' });
    await act(() => jest.advanceTimersByTime(200));
    expect(result.current[0]).toBe('m'); // still typing
    await act(() => jest.advanceTimersByTime(100));
    expect(result.current[0]).toBe('mil');

    await rerender({ value: 'milk' });
    await act(() => result.current[1]());
    expect(result.current[0]).toBe('milk');
  });
});

describe('useProductPages', () => {
  it('loads page by page until the last one', async () => {
    const calls = mockFetch(catalogHandler(PRODUCTS));
    const { result } = await renderHook(() => useProductPages({}), { wrapper });

    await waitFor(() => expect(result.current.data?.products).toHaveLength(PRODUCT_PAGE_SIZE));
    expect(result.current.data?.count).toBe(45);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.products).toHaveLength(45));
    expect(result.current.hasNextPage).toBe(false);
    expect(new Set(result.current.data?.products.map((p) => p.id)).size).toBe(45);
    expect(productRequests(calls)).toEqual([
      '/catalog/products/?page_size=20',
      '/catalog/products/?page=2&page_size=20',
      '/catalog/products/?page=3&page_size=20',
    ]);
  });

  it('filters by category on the server', async () => {
    const calls = mockFetch(catalogHandler(PRODUCTS));
    const { result } = await renderHook(() => useProductPages({ category: 'Snacks' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(15);
    expect(result.current.data?.products.every((p) => p.category === 'Snacks')).toBe(true);
    expect(productRequests(calls)[0]).toBe('/catalog/products/?category=Snacks&page_size=20');
  });

  it('drops a product repeated across pages (catalogue changed while scrolling)', async () => {
    const page1 = [apiProduct(1), apiProduct(2)];
    mockFetch((call) => {
      const page = new URL(call.url).searchParams.get('page');
      const body = page === '2'
        ? { count: 3, next: null, previous: null, results: [apiProduct(2), apiProduct(3)] }
        : { count: 3, next: 'http://test.local/api/catalog/products/?page=2', previous: null, results: page1 };
      return { ok: true, status: 200, text: async () => JSON.stringify(body) } as unknown as Response;
    });
    const { result } = await renderHook(() => useProductPages({}), { wrapper });
    // Read `data` like a screen does: React Query only re-renders for fields that are read.
    await waitFor(() => expect(result.current.data?.products.map((p) => p.id)).toEqual([1, 2]));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.products.map((p) => p.id)).toEqual([1, 2, 3]));
  });

  it('does not request anything while disabled', async () => {
    const calls = mockFetch(catalogHandler(PRODUCTS));
    await renderHook(() => useProductPages({ search: 'm' }, { enabled: false }), { wrapper });
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(calls).toHaveLength(0);
  });

  it('shares one cache entry for equivalent searches', () => {
    expect(productListKey({ search: ' Milk ' })).toEqual(productListKey({ search: 'milk' }));
    expect(productListKey({ search: 'milk' })).not.toEqual(productListKey({ search: 'milk', category: 'Snacks' }));
  });
});
