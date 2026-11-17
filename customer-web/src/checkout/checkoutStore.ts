// Adapted from mobile/src/checkout/checkoutStore.ts (localStorage instead of AsyncStorage).
/**
 * Checkout state that outlives the checkout page:
 *
 * - The chosen delivery address (in memory).
 * - The pending submission: the exact order sent to POST /customer/orders/, with its
 *   requestId, saved in the browser BEFORE it is sent. If the answer never arrives
 *   (timeout, lost connection, tab closed), the same requestId and lines are sent again
 *   and the server returns the order it already created instead of making a second one.
 *   Only ids, quantities, the address id and the note are stored; nothing sensitive.
 */
import { useSyncExternalStore } from 'react';

import type { OrderLine } from '@/api/types';
import { storage } from '@/lib/storage';

export const PENDING_KEY = 'alzaryab.checkout.pending.v1';

export interface PendingSubmission {
  requestId: string;
  items: OrderLine[];
  addressId: number;
  note: string;
  /** Server total shown when the customer confirmed (for the retry message). */
  total: number;
  createdAt: string;
}

interface State {
  addressId: number | null;
  pending: PendingSubmission | null;
  pendingLoaded: boolean;
}

let state: State = { addressId: null, pending: null, pendingLoaded: false };
const listeners = new Set<() => void>();

function set(changes: Partial<State>) {
  state = { ...state, ...changes };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCheckoutState(): State {
  return useSyncExternalStore(subscribe, () => state);
}

export function selectCheckoutAddress(addressId: number | null) {
  set({ addressId });
}

export function isPending(value: unknown): value is PendingSubmission {
  const p = value as PendingSubmission | null;
  return (
    !!p &&
    typeof p.requestId === 'string' &&
    typeof p.addressId === 'number' &&
    Array.isArray(p.items) &&
    p.items.every((i) => Number.isInteger(i?.productId) && Number.isInteger(i?.quantity) && i.quantity > 0)
  );
}

/** Reads a submission left over from an earlier visit. */
export async function loadPendingSubmission(): Promise<void> {
  if (state.pendingLoaded) return;
  let parsed: unknown = null;
  try {
    const raw = storage.get(PENDING_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  set({ pending: isPending(parsed) ? parsed : null, pendingLoaded: true });
}

export async function savePendingSubmission(pending: PendingSubmission) {
  set({ pending, pendingLoaded: true });
  storage.set(PENDING_KEY, JSON.stringify(pending));
}

export async function clearPendingSubmission() {
  set({ pending: null, pendingLoaded: true });
  storage.remove(PENDING_KEY);
}

/** On sign-out: forget everything (the next customer on this browser starts clean). */
export function resetCheckoutStore() {
  storage.remove(PENDING_KEY);
  set({ addressId: null, pending: null, pendingLoaded: false });
}

/** Random v4 UUID for requestId (unique among one customer's orders; not a secret). */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16));
  hex[12] = 4;
  hex[16] = (hex[16] & 0x3) | 0x8;
  const s = hex.map((n) => n.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
