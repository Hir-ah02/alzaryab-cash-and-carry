import { keepPreviousData, useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';

import { getProduct, listCategories, listProducts } from '@/api/catalog';
import type { CatalogProduct, Paginated } from '@/api/types';
import { queryKeys } from '@/lib/queryClient';

/** Products per request. 20 fills a phone screen about three times. */
export const PRODUCT_PAGE_SIZE = 20;

export interface ProductListParams {
  search?: string;
  category?: string;
}

export interface ProductList {
  products: CatalogProduct[];
  /** Total matching products on the server. */
  count: number;
}

/** Normalised so equivalent lists share one cache entry ("Milk " and "milk" are the same search). */
export function productListKey({ search = '', category = '' }: ProductListParams) {
  return queryKeys.productPages({ search: search.trim().toLowerCase(), category, pageSize: PRODUCT_PAGE_SIZE });
}

/** Flattens the pages. If the catalogue changed between pages, a product could appear twice; keep the first. */
function flattenPages(data: InfiniteData<Paginated<CatalogProduct>, number>): ProductList {
  const seen = new Set<number>();
  const products: CatalogProduct[] = [];
  for (const page of data.pages) {
    for (const product of page.results) {
      if (!seen.has(product.id)) {
        seen.add(product.id);
        products.push(product);
      }
    }
  }
  return { products, count: data.pages[0]?.count ?? 0 };
}

/**
 * Active, available products from GET /catalog/products/, A–Z, loaded a page
 * at a time (infinite scroll). Leaving the screen or changing the search
 * cancels the request in flight.
 */
export function useProductPages(params: ProductListParams, { enabled = true, keepPrevious = false } = {}) {
  const queryKey = productListKey(params);
  const { search, category } = queryKey[2];
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => listProducts({ search, category, page: pageParam, pageSize: PRODUCT_PAGE_SIZE }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.next ? pages.length + 1 : undefined),
    select: flattenPages,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    enabled,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => listCategories({ signal }),
  });
}

export function useProduct(id: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ''),
    queryFn: ({ signal }) => getProduct(id!, { signal }),
    enabled: id !== undefined && id !== '',
  });
}
