// Copied from mobile/src/checkout/submitOrder.ts (shared business logic, keep the two in step).
/**
 * Sends the pending submission and decides what its result means.
 *
 * - placed:    the server answered with the order (201 new, or 200 when this
 *              requestId had already created it). Safe to clear the cart.
 * - rejected:  the server answered with an error before creating anything
 *              (400 stock/address/validation, 401 session ended, 403, 429).
 *              The order definitely doesn't exist; the cart is kept.
 * - uncertain: no answer (network, timeout) or a server error (5xx). The
 *              order may or may not exist. Keep the requestId and lines and
 *              send exactly the same submission again.
 */
import { ApiError } from '@/api/errors';
import { placeOrder } from '@/api/orders';
import type { OrderDetail } from '@/api/types';

import type { PendingSubmission } from './checkoutStore';

export type SubmitOutcome =
  | { kind: 'placed'; order: OrderDetail }
  | { kind: 'rejected'; error: ApiError }
  | { kind: 'uncertain'; error: unknown };

export function isDefiniteRejection(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'not_configured' || error.code === 'not_authenticated') return true; // never sent
  return error.status >= 400 && error.status < 500;
}

export async function submitOrder(pending: PendingSubmission): Promise<SubmitOutcome> {
  try {
    const order = await placeOrder({
      items: pending.items,
      addressId: pending.addressId,
      note: pending.note,
      paymentMethod: 'cash_on_delivery',
      requestId: pending.requestId,
    });
    return { kind: 'placed', order };
  } catch (error) {
    return isDefiniteRejection(error) ? { kind: 'rejected', error } : { kind: 'uncertain', error };
  }
}
