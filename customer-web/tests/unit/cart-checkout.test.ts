import { describe, expect, it } from 'vitest';

import './setup-browser';

import { reviewCart } from '@/cart/cartCheck';
import { cartReducer, cartSubtotal, emptyCart, MAX_QUANTITY_PER_ITEM, parseStoredCart } from '@/cart/cartReducer';
import { isPending, newRequestId } from '@/checkout/checkoutStore';

const tea = { id: 1, name: 'Tea', unit: '25 bags', price: 350, image: null };

describe('cart (shared with the mobile app)', () => {
  it('adds, merges, caps and removes', () => {
    let s = cartReducer(emptyCart, { type: 'add', product: tea, quantity: 2 });
    s = cartReducer(s, { type: 'add', product: tea, quantity: 3 });
    expect(s.items[0].quantity).toBe(5);
    s = cartReducer(s, { type: 'setQuantity', productId: 1, quantity: 1000 });
    expect(s.items[0].quantity).toBe(MAX_QUANTITY_PER_ITEM);
    s = cartReducer(s, { type: 'setQuantity', productId: 1, quantity: 0 });
    expect(s.items).toHaveLength(0);
  });

  it('subtotal is exact in paisa', () => {
    const s = cartReducer(emptyCart, { type: 'add', product: { ...tea, price: 0.1 }, quantity: 3 });
    expect(cartSubtotal(s)).toBe(0.3);
  });

  it('drops damaged stored carts safely', () => {
    expect(parseStoredCart('not json')).toEqual([]);
    expect(parseStoredCart(JSON.stringify({ items: [{ productId: -1, quantity: 1, price: 1 }, { productId: 2, quantity: 2, price: 10, name: 'X' }] }))).toHaveLength(1);
  });

  it('review flags price changes and items no longer sold', () => {
    const items = [
      { productId: 1, name: 'Tea', unit: '25 bags', price: 350, image: null, quantity: 1 },
      { productId: 2, name: 'Gone', unit: '1', price: 10, image: null, quantity: 1 },
    ];
    const live = { 1: { ...tea, price: 400, category: 'B', categoryId: 1, description: '', stockStatus: 'in' as const, inStock: true }, 2: null };
    const review = reviewCart(items, live);
    expect(review.issues.map((i) => i.kind).sort()).toEqual(['priceChanged', 'removed']);
  });
});

describe('checkout store', () => {
  it('validates a stored pending submission', () => {
    expect(isPending({ requestId: 'x', addressId: 1, items: [{ productId: 1, quantity: 2 }] })).toBe(true);
    expect(isPending({ requestId: 'x', addressId: 1, items: [{ productId: 1, quantity: 0 }] })).toBe(false);
    expect(isPending(null)).toBe(false);
  });
  it('makes v4 UUIDs', () => {
    expect(newRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
