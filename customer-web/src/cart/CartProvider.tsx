// Adapted from mobile/src/cart/CartProvider.tsx (localStorage instead of AsyncStorage,
// plus syncing between open tabs).
/**
 * Cart kept in the browser (not sensitive: product ids, names, display prices and
 * quantities), so it survives reloads and works before the customer signs in.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { storage } from '@/lib/storage';

import {
  cartCount,
  cartReducer,
  cartSubtotal,
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

function loadCart() {
  return { items: parseStoredCart(storage.get(CART_KEY)) };
}

export function CartProvider({ children }: { children: ReactNode }) {
  // localStorage is synchronous, so the cart is ready on the first render.
  const [state, dispatch] = useReducer(cartReducer, undefined, loadCart);
  const skipNextSave = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false; // don't rewrite what was just loaded
      return;
    }
    storage.set(CART_KEY, JSON.stringify(state));
  }, [state]);

  // Another tab changed the cart: show the same cart here.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CART_KEY) return;
      skipNextSave.current = true;
      dispatch({ type: 'hydrate', items: parseStoredCart(event.newValue) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
      hydrated: true,
      quantityOf: (productId) => state.items.find((i) => i.productId === productId)?.quantity ?? 0,
    }),
    [actions, state],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
