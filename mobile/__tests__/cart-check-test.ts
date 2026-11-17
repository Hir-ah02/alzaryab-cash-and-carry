import { setApiBaseUrl } from '@/api/client';
import type { CatalogProduct } from '@/api/types';
import { describeIssue, fetchCartProducts, resolveIssues, reviewCart } from '@/cart/cartCheck';
import type { CartItem } from '@/cart/cartReducer';
import { formatPrice } from '@/utils/format';

import { apiProduct, catalogHandler, jsonResponse, mockFetch } from './helpers';

beforeEach(() => setApiBaseUrl('http://test.local/api'));

const item = (productId: number, overrides: Partial<CartItem> = {}): CartItem => ({
  productId,
  name: `Product ${productId}`,
  unit: '1 kg',
  price: 100,
  image: null,
  quantity: 1,
  ...overrides,
});
const live = (id: number, overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  ...apiProduct(id, { name: `Product ${id}`, unit: '1 kg' }),
  price: 100,
  ...overrides,
});

describe('fetchCartProducts', () => {
  it('reads each product from the live catalogue; 404 means no longer on sale', async () => {
    const calls = mockFetch(catalogHandler([apiProduct(1, { price: '120.50' }), apiProduct(2)]));
    const result = await fetchCartProducts([1, 2, 3, 1]);
    expect(result[1]?.price).toBe(120.5);
    expect(result[2]?.id).toBe(2);
    expect(result[3]).toBeNull();
    expect(calls).toHaveLength(3); // duplicates fetched once
  });

  it('fails the whole check when offline or the server errors, instead of guessing', async () => {
    mockFetch(() => {
      throw new TypeError('Network request failed');
    });
    await expect(fetchCartProducts([1, 2])).rejects.toMatchObject({ code: 'network' });

    mockFetch(() => jsonResponse(500, {}));
    await expect(fetchCartProducts([1])).rejects.toMatchObject({ status: 500 });
  });

  it('limits requests in flight to 4', async () => {
    let active = 0;
    let peak = 0;
    const handler = catalogHandler(Array.from({ length: 12 }, (_, i) => apiProduct(i + 1)));
    mockFetch(async (call) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return handler(call);
    });
    const result = await fetchCartProducts(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(Object.keys(result)).toHaveLength(12);
    expect(peak).toBe(4);
  });
});

describe('reviewCart', () => {
  it('passes a cart that matches the catalogue', () => {
    const review = reviewCart([item(1), item(2)], { 1: live(1), 2: live(2) });
    expect(review).toEqual({ issues: [], lowStock: [], quietUpdates: [], unchecked: [] });
  });

  it('finds price changes, pack size changes, removed and out-of-stock products', () => {
    const review = reviewCart([item(1), item(2), item(3), item(4), item(5)], {
      1: live(1, { price: 110 }),
      2: live(2, { unit: '500 g' }),
      3: null,
      4: live(4, { inStock: false, stockStatus: 'out' }),
      5: live(5, { stockStatus: 'low' }),
    });
    expect(review.issues).toEqual([
      { kind: 'priceChanged', productId: 1, name: 'Product 1', oldPrice: 100, newPrice: 110 },
      { kind: 'unitChanged', productId: 2, name: 'Product 2', oldUnit: '1 kg', newUnit: '500 g' },
      { kind: 'removed', productId: 3, name: 'Product 3' },
      { kind: 'outOfStock', productId: 4, name: 'Product 4' },
    ]);
    expect(review.lowStock).toEqual([5]);
    expect(describeIssue(review.issues[0], formatPrice)).toBe('Product 1 is now Rs. 110 (was Rs. 100).');
  });

  it('treats price drops as changes too, and ignores sub-paisa float noise', () => {
    expect(reviewCart([item(1)], { 1: live(1, { price: 90 }) }).issues).toHaveLength(1);
    expect(reviewCart([item(1, { price: 0.3 })], { 1: live(1, { price: 0.1 + 0.2 }) }).issues).toHaveLength(0);
  });

  it('refreshes names and photos quietly, and notes items the check did not cover', () => {
    const review = reviewCart([item(1), item(9)], { 1: live(1, { name: 'Fresh Product 1', image: 'http://x/new.png' }) });
    expect(review.issues).toEqual([]);
    expect(review.quietUpdates).toEqual([{ productId: 1, name: 'Fresh Product 1', image: 'http://x/new.png' }]);
    expect(review.unchecked).toEqual([9]);
  });
});

it('accepting changes removes what cannot be bought and takes the current price and unit', () => {
  const products = { 1: live(1, { price: 110 }), 2: null, 3: live(3, { inStock: false }), 4: live(4, { unit: '2 kg', price: 180 }) };
  const { issues } = reviewCart([item(1), item(2), item(3), item(4)], products);
  const { remove, updates } = resolveIssues(issues, products);
  expect(remove).toEqual([2, 3]);
  expect(updates).toEqual([
    expect.objectContaining({ productId: 1, price: 110, unit: '1 kg' }),
    expect.objectContaining({ productId: 4, price: 180, unit: '2 kg' }),
    expect.objectContaining({ productId: 4, price: 180, unit: '2 kg' }),
  ]);
});
