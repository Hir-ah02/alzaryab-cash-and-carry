/**
 * Where to go after signing in, e.g. Cart → Checkout → Sign in → Checkout.
 * Only known in-app screens are accepted, so a link can't send the customer
 * somewhere unexpected. Kept in memory: after an app restart the customer
 * simply starts from where they are.
 */
const ALLOWED = ['/checkout', '/orders', '/addresses', '/profile'] as const;
export type ReturnTarget = (typeof ALLOWED)[number];

let target: ReturnTarget | null = null;

export function isReturnTarget(value: unknown): value is ReturnTarget {
  return typeof value === 'string' && (ALLOWED as readonly string[]).includes(value);
}

export function setReturnTo(value: unknown) {
  target = isReturnTarget(value) ? value : null;
}

/** Reads and forgets the destination. */
export function takeReturnTo(): ReturnTarget | null {
  const value = target;
  target = null;
  return value;
}
