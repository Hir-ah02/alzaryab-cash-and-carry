// Adapted from mobile/src/lib/queryClient.ts (the browser's own focus events are used).
import { QueryClient } from '@tanstack/react-query';

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
      // Catalogue data is reused for a minute, then refetched in the background.
      queries: { retry: shouldRetry, staleTime: 60_000, gcTime: 5 * 60_000 },
      mutations: { retry: false },
    },
  });
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
