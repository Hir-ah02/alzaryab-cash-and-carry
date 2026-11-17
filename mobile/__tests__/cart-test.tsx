import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { CART_KEY, CartProvider, useCart } from '@/cart/CartProvider';
import { cartCount, cartReducer, cartSubtotal, emptyCart, isValidQuantity, MAX_QUANTITY_PER_ITEM, parseStoredCart } from '@/cart/cartReducer';

const milk = { id: 1, name: 'Milk', unit: '1 L', price: 320, image: null };
const eggs = { id: 2, name: 'Eggs', unit: '1 dozen', price: 390.5, image: null };

describe('cart rules', () => {
  it('adds, merges, changes and removes items', () => {
    let state = cartReducer(emptyCart, { type: 'add', product: milk });
    state = cartReducer(state, { type: 'add', product: milk, quantity: 2 });
    state = cartReducer(state, { type: 'add', product: eggs });
    expect(state.items.map((i) => [i.productId, i.quantity])).toEqual([[1, 3], [2, 1]]);
    expect(cartCount(state)).toBe(4);
    expect(cartSubtotal(state)).toBe(1350.5);

    state = cartReducer(state, { type: 'setQuantity', productId: 2, quantity: 3 }); // increase
    state = cartReducer(state, { type: 'setQuantity', productId: 2, quantity: 2 }); // decrease
    expect(state.items[1].quantity).toBe(2);
    state = cartReducer(state, { type: 'setQuantity', productId: 1, quantity: 0 });
    expect(state.items.map((i) => i.productId)).toEqual([2]);
    state = cartReducer(state, { type: 'setQuantity', productId: 2, quantity: 500 });
    expect(state.items[0].quantity).toBe(MAX_QUANTITY_PER_ITEM);
    expect(cartReducer(state, { type: 'remove', productId: 2 }).items).toEqual([]);
    expect(cartReducer(state, { type: 'clear' }).items).toEqual([]);
  });

  it('only accepts positive whole quantities', () => {
    expect([1, 5, 100].every(isValidQuantity)).toBe(true);
    expect([0, -1, 1.5, Number.NaN, Infinity, '2' as unknown as number].some(isValidQuantity)).toBe(false);
    for (const quantity of [0, -3, 2.5, Number.NaN]) {
      expect(cartReducer(emptyCart, { type: 'add', product: milk, quantity })).toBe(emptyCart);
    }
    const one = cartReducer(emptyCart, { type: 'add', product: milk });
    expect(cartReducer(one, { type: 'setQuantity', productId: 1, quantity: Number.NaN })).toBe(one);
    expect(cartReducer(one, { type: 'setQuantity', productId: 1, quantity: 2.9 }).items[0].quantity).toBe(2);
  });

  it('updates details and removes several items at once', () => {
    let state = cartReducer(cartReducer(emptyCart, { type: 'add', product: milk }), { type: 'add', product: eggs });
    state = cartReducer(state, { type: 'update', updates: [{ productId: 1, price: 340, unit: '1.5 L' }] });
    expect(state.items[0]).toMatchObject({ price: 340, unit: '1.5 L', quantity: 1 });
    expect(cartReducer(state, { type: 'update', updates: [{ productId: 1, price: 340 }] })).toBe(state); // nothing changed
    expect(cartReducer(state, { type: 'removeMany', productIds: [1, 2] }).items).toEqual([]);
  });

  it('restores damaged saved carts safely', () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart('{nope')).toEqual([]);
    expect(parseStoredCart('null')).toEqual([]);
    const rows = [
      { productId: 'x', quantity: 1, price: 1 },
      { productId: 1, quantity: 2, name: 'Milk', price: 320 },
      { productId: 1, quantity: 1, name: 'Milk', price: 320 }, // duplicate: merged
      { productId: 2, quantity: 0, price: 10 }, // no quantity
      { productId: 3, quantity: 1 }, // no price
      { productId: 4, quantity: 900, price: 5, name: 'Salt', unit: '1 kg', image: 'http://x/a.png' },
    ];
    expect(parseStoredCart(JSON.stringify({ items: rows }))).toEqual([
      { productId: 1, name: 'Milk', unit: '', price: 320, image: null, quantity: 3 },
      { productId: 4, name: 'Salt', unit: '1 kg', price: 5, image: 'http://x/a.png', quantity: MAX_QUANTITY_PER_ITEM },
    ]);
  });
});

describe('CartProvider', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>;

  beforeEach(() => AsyncStorage.clear());

  async function renderCart() {
    const view = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(view.result.current.hydrated).toBe(true));
    return view.result;
  }

  async function saved() {
    return JSON.parse((await AsyncStorage.getItem(CART_KEY)) ?? '{"items":[]}').items as { productId: number; quantity: number }[];
  }

  it('restores the saved cart and saves changes to AsyncStorage', async () => {
    await AsyncStorage.setItem(CART_KEY, JSON.stringify({ items: [{ productId: 1, name: 'Milk', unit: '1 L', price: 320, image: null, quantity: 2 }] }));
    const result = await renderCart();
    expect(result.current.count).toBe(2);

    await act(() => {
      result.current.add(eggs);
    });
    await waitFor(async () => expect(await saved()).toHaveLength(2));
    expect(result.current.subtotal).toBe(1030.5);

    await act(() => result.current.setQuantity(1, 5));
    await act(() => result.current.remove(2));
    await waitFor(async () => expect(await saved()).toEqual([expect.objectContaining({ productId: 1, quantity: 5 })]));

    await act(() => result.current.clear());
    await waitFor(async () => expect(await saved()).toEqual([]));
  });

  it('survives a restart (a new provider reads the saved cart)', async () => {
    const first = await renderCart();
    await act(() => {
      first.current.add(milk, 3);
    });
    await waitFor(async () => expect(await saved()).toHaveLength(1));

    const second = await renderCart();
    expect(second.current.items).toEqual([{ productId: 1, name: 'Milk', unit: '1 L', price: 320, image: null, quantity: 3 }]);
  });

  it('saves nothing sensitive: only product details and quantities', async () => {
    const result = await renderCart();
    await act(() => {
      result.current.add({ ...milk, inStock: true }, 1);
    });
    await waitFor(async () => expect(await saved()).toHaveLength(1));
    const raw = (await AsyncStorage.getItem(CART_KEY))!;
    expect(Object.keys(JSON.parse(raw).items[0]).sort()).toEqual(['image', 'name', 'price', 'productId', 'quantity', 'unit']);
  });

  it('reports what add did', async () => {
    const result = await renderCart();
    let outcome: unknown;
    await act(() => {
      outcome = result.current.add({ ...milk, inStock: false }, 1);
    });
    expect(outcome).toEqual({ ok: false, reason: 'outOfStock' });
    expect(result.current.count).toBe(0);

    await act(() => {
      outcome = result.current.add(milk, 0);
    });
    expect(outcome).toEqual({ ok: false, reason: 'invalidQuantity' });

    await act(() => {
      outcome = result.current.add(milk, 98);
    });
    expect(outcome).toEqual({ ok: true, added: 98, capped: false });
    await act(() => {
      outcome = result.current.add(milk, 5);
    });
    expect(outcome).toEqual({ ok: true, added: 2, capped: true });
    expect(result.current.quantityOf(1)).toBe(MAX_QUANTITY_PER_ITEM);
    await act(() => {
      outcome = result.current.add(milk, 1);
    });
    expect(outcome).toEqual({ ok: false, reason: 'limitReached' });
  });

  it('keeps its actions stable between renders', async () => {
    const result = await renderCart();
    const { add, remove, setQuantity } = result.current;
    await act(() => {
      result.current.add(milk);
    });
    expect(result.current.add).toBe(add);
    expect(result.current.remove).toBe(remove);
    expect(result.current.setQuantity).toBe(setQuantity);
  });
});
