/**
 * Product service – the ONLY place the UI reads or writes product data.
 * Backed by the Django API (/api/products/); see backend/README.md.
 *
 * Product shape used by the pages:
 *   { id: number, name, category: string (name), categoryId, description, unit,
 *     price: number, stock: number, stockStatus: 'in'|'low'|'out',
 *     image: string (absolute URL) | null, isAvailable, active, createdAt, updatedAt }
 */
import { apiRequest } from './apiClient.js';

/** API product → page product. Prices arrive as decimal strings ("320.00"). */
function toProduct(p) {
  return { ...p, price: Number(p.price) };
}

/** "1,800" → "1800": the form allows thousands separators, the API doesn't. */
function cleanPrice(value) {
  return String(value).replace(/,/g, '').trim();
}

function isFile(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

/**
 * Form data → request body.
 * data.image: a File to upload, null to remove the current image, or undefined to keep it.
 * Uses multipart/form-data only when there is a file to send.
 */
function toBody(data, { isUpdate = false } = {}) {
  const fields = {
    name: String(data.name).trim(),
    category: data.category,
    unit: String(data.unit).trim(),
    stock: String(data.stock).trim(),
    price: cleanPrice(data.price),
  };
  if (data.description !== undefined) fields.description = String(data.description).trim();
  if (data.isAvailable !== undefined) fields.isAvailable = Boolean(data.isAvailable);

  if (isFile(data.image)) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append('image', data.image, data.image.name);
    return form;
  }
  if (isUpdate && data.image === null) return { ...fields, image: null };
  return fields;
}

/** Which products a list includes: removed (inactive) products are left out unless asked for. */
export const PRODUCT_ACTIVE_FILTERS = ['true', 'false', 'all'];

/**
 * One page of products, newest first. Search and filters run on the server.
 * `active`: 'true' active only, 'false' removed only, 'all' both; omitted = the server default (active only).
 * @param {{ search?: string, category?: string, stock?: 'in'|'low'|'out'|'', active?: 'true'|'false'|'all'|'', page?: number, pageSize?: number }} params
 * @returns {Promise<{ items: Product[], total: number }>}
 *   Rejects with err.status = 404 if the page is past the end.
 */
export async function listProducts({ search = '', category = '', stock = '', active = '', page = 1, pageSize = 10 } = {}) {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (category) query.set('category', category);
  if (stock) query.set('stock', stock);
  if (PRODUCT_ACTIVE_FILTERS.includes(active)) query.set('active', active);
  if (page > 1) query.set('page', String(page));
  query.set('page_size', String(pageSize));

  const data = await apiRequest(`/products/?${query}`);
  return { items: data.results.map(toProduct), total: data.count };
}

/** One active product. Rejects with err.status = 404 if missing or removed. */
export async function getProduct(id) {
  return toProduct(await apiRequest(`/products/${encodeURIComponent(id)}/`));
}

/** Rejects with err.fields = { name, price, image, … } for invalid data. */
export async function createProduct(data) {
  return toProduct(await apiRequest('/products/', { method: 'POST', body: toBody(data) }));
}

/** Partial update: only the fields the form edits; the image is kept unless replaced or removed. */
export async function updateProduct(id, data) {
  const body = toBody(data, { isUpdate: true });
  return toProduct(await apiRequest(`/products/${encodeURIComponent(id)}/`, { method: 'PATCH', body }));
}

/** Soft delete: the product leaves active inventory but its record is kept. */
export async function removeProduct(id) {
  await apiRequest(`/products/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  return { id };
}

/** @returns {Promise<{ total: number, inStock: number, lowStock: number, outOfStock: number }>} */
export async function summarize() {
  return apiRequest('/products/summary/');
}
