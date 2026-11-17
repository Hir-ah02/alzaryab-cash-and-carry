/**
 * Checkout state that outlives the checkout screen:
 *
 * - The chosen delivery address (in memory, so adding an address from
 *   checkout can select it).
 * - The pending submission: the exact order sent to POST /customer/orders/,
 *   with its requestId, saved on the device BEFORE it is sent. If the answer
 *   never arrives (timeout, lost connection, app closed), the same requestId
 *   and lines are sent again, and the server returns the order it already
 *   created instead of making a second one. Only ids, quantities, the address
 *   id and the note are stored; nothing sensitive.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { OrderLine } from '@/api/types';

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

function isPending(value: unknown): value is PendingSubmission {
  const p = value as PendingSubmission | null;
  return (
    !!p &&
    typeof p.requestId === 'string' &&
    typeof p.addressId === 'number' &&
    Array.isArray(p.items) &&
    p.items.every((i) => Number.isInteger(i?.productId) && Number.isInteger(i?.quantity) && i.quantity > 0)
  );
}

let loading: Promise<void> | null = null;

/** Reads a submission left over from an earlier session (once). */
export function loadPendingSubmission(): Promise<void> {
  if (state.pendingLoaded) return Promise.resolve();
  loading ??= AsyncStorage.getItem(PENDING_KEY)
    .then((raw) => {
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      set({ pending: isPending(parsed) ? parsed : null, pendingLoaded: true });
    })
    .catch(() => set({ pendingLoaded: true }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function savePendingSubmission(pending: PendingSubmission) {
  set({ pending, pendingLoaded: true });
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export async function clearPendingSubmission() {
  set({ pending: null, pendingLoaded: true });
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
}

/** Test helper. */
export function resetCheckoutStoreForTests() {
  state = { addressId: null, pending: null, pendingLoaded: false };
  loading = null;
}

/**
 * Random v4 UUID for requestId. Uses crypto.randomUUID when the runtime has it;
 * otherwise Math.random, which is enough here: the id only has to be unique
 * among one customer's orders, it is not a secret.
 */
export function newRequestId(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (native) return native.call((globalThis as { crypto: object }).crypto);
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16));
  hex[12] = 4;
  hex[16] = (hex[16] & 0x3) | 0x8;
  const s = hex.map((n) => n.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
