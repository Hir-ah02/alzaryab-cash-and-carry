/**
 * Cart kept on the device (AsyncStorage: not sensitive, only product ids,
 * names, display prices and quantities), so it survives app restarts and
 * works before the customer signs in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import {
  cartCount,
  cartReducer,
  cartSubtotal,
  emptyCart,
  isValidQuantity,
  MAX_QUANTITY_PER_ITEM,
  parseStoredCart,
  type CartItem,
  type CartItemUpdate,
  type CartProductInput,
} from './cartReducer';

export const CART_KEY = 'alzaryab.cart.v1';

export type AddToCartResult =
  | { ok: true; added: number; capped: boolean }
  | { ok: false; reason: 'outOfStock' | 'invalidQuantity' | 'limitReached' };

export interface CartActions {
  /** Adds a positive whole quantity. Refuses products known to be out of stock and caps at MAX_QUANTITY_PER_ITEM. */
  add: (product: CartProductInput & { inStock?: boolean }, quantity?: number) => AddToCartResult;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  removeMany: (productIds: number[]) => void;
  update: (updates: CartItemUpdate[]) => void;
  /** Removes what an order just bought; the rest of the cart stays. */
  subtract: (lines: { productId: number; quantity: number }[]) => void;
  clear: () => void;
}

interface CartContextValue extends CartActions {
  items: CartItem[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  quantityOf: (productId: number) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, emptyCart);
  const [hydrated, setHydrated] = useState(false);
  const skipNextSave = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then((raw) => dispatch({ type: 'hydrate', items: parseStoredCart(raw) }))
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false; // don't rewrite what was just loaded
      return;
    }
    AsyncStorage.setItem(CART_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  // Stable for the app's lifetime, so memoised rows that only call actions don't re-render.
  const actions = useMemo<CartActions>(
    () => ({
      add: (product, quantity = 1) => {
        if (!isValidQuantity(quantity)) return { ok: false, reason: 'invalidQuantity' };
        if (product.inStock === false) return { ok: false, reason: 'outOfStock' };
        const inCart = stateRef.current.items.find((i) => i.productId === product.id)?.quantity ?? 0;
        const room = MAX_QUANTITY_PER_ITEM - inCart;
        if (room <= 0) return { ok: false, reason: 'limitReached' };
        const added = Math.min(quantity, room);
        dispatch({ type: 'add', product, quantity: added });
        return { ok: true, added, capped: added < quantity };
      },
      setQuantity: (productId, quantity) => dispatch({ type: 'setQuantity', productId, quantity }),
      remove: (productId) => dispatch({ type: 'remove', productId }),
      removeMany: (productIds) => dispatch({ type: 'removeMany', productIds }),
      update: (updates) => dispatch({ type: 'update', updates }),
      subtract: (lines) => dispatch({ type: 'subtract', lines }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      ...actions,
      items: state.items,
      count: cartCount(state),
      subtotal: cartSubtotal(state),
      hydrated,
      quantityOf: (productId) => state.items.find((i) => i.productId === productId)?.quantity ?? 0,
    }),
    [actions, state, hydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
