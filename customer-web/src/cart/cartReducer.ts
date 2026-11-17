// Copied from mobile/src/cart/cartReducer.ts (shared business logic, keep the two in step).
/**
 * Cart state. Pure functions, so they are easy to test.
 * Prices here are for display only; the server prices every order.
 */
import { sumLines } from '@/api/money';
import type { CatalogProduct } from '@/api/types';

/** Matches ORDER_MAX_QUANTITY_PER_ITEM on the server. */
export const MAX_QUANTITY_PER_ITEM = 100;

export interface CartItem {
  productId: number;
  name: string;
  unit: string;
  /** Price in rupees when added (or when the customer accepted a price change). */
  price: number;
  image: string | null;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
}

export type CartProductInput = Pick<CatalogProduct, 'id' | 'name' | 'unit' | 'price' | 'image'>;

/** Fields that can be refreshed from the catalogue. */
export type CartItemUpdate = { productId: number } & Partial<Pick<CartItem, 'name' | 'unit' | 'price' | 'image'>>;

export type CartAction =
  | { type: 'hydrate'; items: CartItem[] }
  | { type: 'add'; product: CartProductInput; quantity?: number }
  | { type: 'setQuantity'; productId: number; quantity: number }
  | { type: 'remove'; productId: number }
  | { type: 'removeMany'; productIds: number[] }
  | { type: 'update'; updates: CartItemUpdate[] }
  /** After an order is placed: take the ordered quantities out (anything added since stays). */
  | { type: 'subtract'; lines: { productId: number; quantity: number }[] }
  | { type: 'clear' };

export const emptyCart: CartState = { items: [] };

/** A quantity the customer can ask for: a whole number from 1 upwards. */
export function isValidQuantity(quantity: unknown): quantity is number {
  return typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1;
}

function clampQuantity(quantity: number) {
  return Math.max(0, Math.min(MAX_QUANTITY_PER_ITEM, Math.floor(quantity)));
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'hydrate':
      return { items: action.items.filter((i) => i.quantity > 0) };
    case 'add': {
      const { product, quantity = 1 } = action;
      if (!isValidQuantity(quantity)) return state;
      const existing = state.items.find((i) => i.productId === product.id);
      if (existing) {
        return cartReducer(state, { type: 'setQuantity', productId: product.id, quantity: existing.quantity + quantity });
      }
      const item: CartItem = {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        image: product.image,
        quantity: clampQuantity(quantity),
      };
      return { items: [...state.items, item] };
    }
    case 'setQuantity': {
      if (!Number.isFinite(action.quantity)) return state;
      const quantity = clampQuantity(action.quantity);
      if (quantity === 0) return cartReducer(state, { type: 'remove', productId: action.productId });
      if (!state.items.some((i) => i.productId === action.productId && i.quantity !== quantity)) return state;
      return { items: state.items.map((i) => (i.productId === action.productId ? { ...i, quantity } : i)) };
    }
    case 'remove':
      return cartReducer(state, { type: 'removeMany', productIds: [action.productId] });
    case 'removeMany': {
      const ids = new Set(action.productIds);
      const items = state.items.filter((i) => !ids.has(i.productId));
      return items.length === state.items.length ? state : { items };
    }
    case 'update': {
      const byId = new Map(action.updates.map((u) => [u.productId, u]));
      let changed = false;
      const items = state.items.map((item) => {
        const update = byId.get(item.productId);
        if (!update) return item;
        const next = { ...item, ...update };
        if (next.name === item.name && next.unit === item.unit && next.price === item.price && next.image === item.image) return item;
        changed = true;
        return next;
      });
      return changed ? { items } : state;
    }
    case 'subtract': {
      const ordered = new Map<number, number>();
      for (const line of action.lines) ordered.set(line.productId, (ordered.get(line.productId) ?? 0) + line.quantity);
      const items = state.items
        .map((item) => (ordered.has(item.productId) ? { ...item, quantity: item.quantity - ordered.get(item.productId)! } : item))
        .filter((item) => item.quantity > 0);
      return { items };
    }
    case 'clear':
      return state.items.length === 0 ? state : emptyCart;
    default:
      return state;
  }
}

export function cartCount(state: CartState) {
  return state.items.reduce((sum, i) => sum + i.quantity, 0);
}

/** Estimate shown in the app, calculated in whole paisa; the order total comes from the server. */
export function cartSubtotal(state: CartState) {
  return sumLines(state.items);
}

/** Restores a cart saved by an older or damaged copy of the app safely: bad rows are dropped, duplicates merged, quantities capped. */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const rows = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(rows)) return [];

  const items = new Map<number, CartItem>();
  for (const row of rows as Partial<CartItem>[]) {
    if (!row || typeof row !== 'object') continue;
    const { productId, quantity, price } = row;
    if (!Number.isInteger(productId) || (productId as number) <= 0) continue;
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) continue;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) continue;

    const id = productId as number;
    const previous = items.get(id);
    items.set(id, {
      productId: id,
      name: typeof row.name === 'string' ? row.name : '',
      unit: typeof row.unit === 'string' ? row.unit : '',
      price,
      image: typeof row.image === 'string' ? row.image : null,
      quantity: clampQuantity((previous?.quantity ?? 0) + quantity),
    });
  }
  return [...items.values()];
}
