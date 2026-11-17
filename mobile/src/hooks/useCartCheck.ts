import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { samePrice } from '@/api/money';
import type { CatalogProduct } from '@/api/types';
import { fetchCartProducts, reviewCart, type CartProducts } from '@/cart/cartCheck';
import type { CartItem } from '@/cart/cartReducer';
import { queryKeys } from '@/lib/queryClient';

function differs(cached: CatalogProduct | undefined, live: CatalogProduct | null) {
  if (!cached) return false;
  return !live || !samePrice(cached.price, live.price) || cached.inStock !== live.inStock || cached.stockStatus !== live.stockStatus;
}

/**
 * Checks the cart against the live catalogue. Never served from cache: it runs
 * whenever the cart screen asks, and the result is only trusted until the next
 * check. Changing quantities doesn't refetch; adding or removing products does.
 */
export function useCartCheck(items: readonly CartItem[], { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const ids = useMemo(() => [...new Set(items.map((i) => i.productId))].sort((a, b) => a - b), [items]);

  const query = useQuery({
    queryKey: queryKeys.cartCheck(ids),
    queryFn: async ({ signal }): Promise<CartProducts> => {
      const products = await fetchCartProducts(ids, signal);

      // Share what we learned: product pages get the fresh data, and lists
      // that may now show an old price or a product no longer on sale refresh.
      let catalogueChanged = false;
      for (const id of ids) {
        const live = products[id];
        if (differs(queryClient.getQueryData<CatalogProduct>(queryKeys.product(id)), live)) catalogueChanged = true;
        if (live) queryClient.setQueryData(queryKeys.product(id), live);
        else {
          queryClient.removeQueries({ queryKey: queryKeys.product(id), exact: true });
          catalogueChanged = true;
        }
      }
      if (catalogueChanged) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.allProductPages });
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      }
      return products;
    },
    enabled: enabled && ids.length > 0,
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: 'always',
  });

  const review = useMemo(() => (query.data ? reviewCart(items, query.data) : null), [items, query.data]);
  return { query, review };
}
