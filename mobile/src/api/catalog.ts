/** Public catalogue: no sign-in needed. Only active, available products are ever returned. */
import { apiRequest, type RequestOptions } from './client';
import type { ApiCatalogProduct, CatalogCategory, CatalogProduct, Paginated } from './types';
import { toMoney } from './money';

export function toCatalogProduct(p: ApiCatalogProduct): CatalogProduct {
  return { ...p, price: toMoney(p.price) };
}

export interface ProductQuery {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

/** GET /catalog/products/  A–Z by name. Rejects with status 404 past the last page. */
export async function listProducts(
  { search = '', category = '', page = 1, pageSize = 20 }: ProductQuery = {},
  options: Pick<RequestOptions, 'signal'> = {},
): Promise<Paginated<CatalogProduct>> {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (category) query.set('category', category);
  if (page > 1) query.set('page', String(page));
  query.set('page_size', String(pageSize));

  const data = await apiRequest<Paginated<ApiCatalogProduct>>(`/catalog/products/?${query}`, options);
  return { ...data, results: data.results.map(toCatalogProduct) };
}

/** GET /catalog/products/{id}/  404 if the product isn't on sale. */
export async function getProduct(id: number | string, options: Pick<RequestOptions, 'signal'> = {}): Promise<CatalogProduct> {
  return toCatalogProduct(await apiRequest<ApiCatalogProduct>(`/catalog/products/${encodeURIComponent(id)}/`, options));
}

/** GET /catalog/categories/  Categories with at least one product on sale, A–Z. */
export async function listCategories(options: Pick<RequestOptions, 'signal'> = {}): Promise<CatalogCategory[]> {
  return apiRequest<CatalogCategory[]>('/catalog/categories/', options);
}
