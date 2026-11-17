// Copied from mobile/src/cart/cartCheck.ts (shared business logic, keep the two in step).
/**
 * Cart check before checkout: compares the saved cart with the live catalogue.
 * The cart only holds what the customer saw earlier; the server is the
 * authority on prices and stock, and checks stock again when the order is
 * placed (Task 7).
 */
import { getProduct } from '@/api/catalog';
import { ApiError } from '@/api/errors';
import { samePrice } from '@/api/money';
import type { CatalogProduct } from '@/api/types';

import type { CartItem, CartItemUpdate } from './cartReducer';

/** Live catalogue entry per product id; null means it is no longer on sale (404). */
export type CartProducts = Record<number, CatalogProduct | null>;

/** Requests in flight at once, so a big cart doesn't flood the server or a slow connection. */
const CONCURRENCY = 4;

/**
 * Fetches every cart product from GET /catalog/products/{id}/. A 404 means the
 * product was deactivated or made unavailable. Any other failure (offline,
 * server error) rejects the whole check, because a partial check can't say the
 * cart is ready.
 */
export async function fetchCartProducts(productIds: readonly number[], signal?: AbortSignal): Promise<CartProducts> {
  const result: CartProducts = {};
  const queue = [...new Set(productIds)];

  async function worker() {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        result[id] = await getProduct(id, { signal });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) result[id] = null;
        else throw err;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return result;
}

export type CartIssue =
  | { kind: 'removed'; productId: number; name: string }
  | { kind: 'outOfStock'; productId: number; name: string }
  | { kind: 'priceChanged'; productId: number; name: string; oldPrice: number; newPrice: number }
  | { kind: 'unitChanged'; productId: number; name: string; oldUnit: string; newUnit: string };

export interface CartReview {
  /** Material changes the customer must accept before checkout. */
  issues: CartIssue[];
  /** Products the store says are running low (exact stock is not public). */
  lowStock: number[];
  /** Name/photo refreshes that change nothing the customer agreed to; applied silently. */
  quietUpdates: CartItemUpdate[];
  /** Cart items this check didn't cover (added since it ran). */
  unchecked: number[];
}

export function reviewCart(items: readonly CartItem[], products: CartProducts): CartReview {
  const review: CartReview = { issues: [], lowStock: [], quietUpdates: [], unchecked: [] };

  for (const item of items) {
    if (!(item.productId in products)) {
      review.unchecked.push(item.productId);
      continue;
    }
    const live = products[item.productId];
    const name = live?.name || item.name;
    if (!live) {
      review.issues.push({ kind: 'removed', productId: item.productId, name });
      continue;
    }
    if (!live.inStock) {
      review.issues.push({ kind: 'outOfStock', productId: item.productId, name });
      continue;
    }
    if (!samePrice(live.price, item.price)) {
      review.issues.push({ kind: 'priceChanged', productId: item.productId, name, oldPrice: item.price, newPrice: live.price });
    }
    if (live.unit !== item.unit) {
      review.issues.push({ kind: 'unitChanged', productId: item.productId, name, oldUnit: item.unit, newUnit: live.unit });
    }
    if (live.stockStatus === 'low') review.lowStock.push(item.productId);
    if (live.name !== item.name || live.image !== item.image) {
      review.quietUpdates.push({ productId: item.productId, name: live.name, image: live.image });
    }
  }
  return review;
}

/** What accepting the issues does to the cart: drop what can't be bought, take the current price and unit. */
export function resolveIssues(issues: readonly CartIssue[], products: CartProducts): { remove: number[]; updates: CartItemUpdate[] } {
  const remove: number[] = [];
  const updates: CartItemUpdate[] = [];
  for (const issue of issues) {
    if (issue.kind === 'removed' || issue.kind === 'outOfStock') {
      remove.push(issue.productId);
      continue;
    }
    const live = products[issue.productId];
    if (live) updates.push({ productId: live.id, name: live.name, unit: live.unit, price: live.price, image: live.image });
  }
  return { remove, updates };
}

export function describeIssue(issue: CartIssue, formatPrice: (n: number) => string): string {
  switch (issue.kind) {
    case 'removed':
      return `${issue.name} is no longer sold and will be removed.`;
    case 'outOfStock':
      return `${issue.name} is out of stock and will be removed.`;
    case 'priceChanged':
      return `${issue.name} is now ${formatPrice(issue.newPrice)} (was ${formatPrice(issue.oldPrice)}).`;
    case 'unitChanged':
      return `${issue.name} is now sold as ${issue.newUnit} (was ${issue.oldUnit}).`;
  }
}
