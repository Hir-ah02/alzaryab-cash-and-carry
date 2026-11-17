import { focusManager, QueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/api/errors';

/** Retry only problems that may go away (network, timeout, 5xx), at most twice. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.isNetworkError || error.status >= 500;
  return false;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Catalogue data is reused for a minute, then refetched in the background
      // the next time a screen needs it; unused data is dropped after 5 minutes.
      queries: { retry: shouldRetry, staleTime: 60_000, gcTime: 5 * 60_000 },
      mutations: { retry: false },
    },
  });
}

/**
 * React Native has no window focus: tell React Query when the app returns to
 * the foreground, so stale screens refresh then (and not while in the background).
 * Returns the unsubscribe function.
 */
export function connectAppFocus() {
  if (Platform.OS === 'web') return () => {};
  const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  return () => subscription.remove();
}

/**
 * Pull-to-refresh for a paged list: keep only the first page and refetch it,
 * instead of refetching every page the customer had scrolled through.
 */
export async function refreshFirstPage(client: QueryClient, queryKey: QueryKey) {
  client.setQueryData<InfiniteData<unknown, unknown>>(queryKey, (data) =>
    data && data.pages.length > 1 ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
  );
  await client.refetchQueries({ queryKey, exact: true });
}

/** Query keys. Everything under 'customer' is removed when the customer signs out. */
export const queryKeys = {
  catalog: ['catalog'] as const,
  categories: ['catalog', 'categories'] as const,
  productPages: <P extends object>(params: P) => ['catalog', 'product-pages', params] as const,
  allProductPages: ['catalog', 'product-pages'] as const,
  product: (id: string | number) => ['catalog', 'product', String(id)] as const,
  cartCheck: (productIds: readonly number[]) => ['catalog', 'cart-check', productIds] as const,
  customer: ['customer'] as const,
  profile: ['customer', 'profile'] as const,
  addresses: ['customer', 'addresses'] as const,
  orders: ['customer', 'orders'] as const,
  orderPages: ['customer', 'orders', 'pages'] as const,
  order: (id: string | number) => ['customer', 'orders', 'detail', String(id)] as const,
  quote: (lines: readonly { productId: number; quantity: number }[]) => ['customer', 'quote', lines] as const,
};
