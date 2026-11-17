// Copied from mobile/src/api/money.ts (shared business logic, keep the two in step).
/**
 * Money helpers. The API sends decimal strings ("1180.50"); the app keeps
 * rupee amounts as numbers for display, but every sum or product is done in
 * whole paisa (integers), so 0.10 + 0.20 is exactly 0.30 and totals never pick
 * up floating-point noise. Order totals are always calculated by the server.
 */

/** Decimal string or number → rupees. Anything unreadable becomes 0. */
export function toMoney(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Rupees → whole paisa. Prices have at most two decimals, so rounding
 * amount × 100 gives the exact integer (safe up to about 90 trillion rupees).
 */
export function toPaisa(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function fromPaisa(paisa: number): number {
  return paisa / 100;
}

/** price × quantity, exact. */
export function lineTotal(price: number, quantity: number): number {
  return fromPaisa(toPaisa(price) * quantity);
}

/** Sum of price × quantity lines, exact. */
export function sumLines(lines: readonly { price: number; quantity: number }[]): number {
  return fromPaisa(lines.reduce((sum, line) => sum + toPaisa(line.price) * line.quantity, 0));
}

export function samePrice(a: number, b: number): boolean {
  return toPaisa(a) === toPaisa(b);
}
