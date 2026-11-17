/**
 * Web version of mobile/src/auth/tokenStorage.ts.
 *
 * - The refresh token (7 days, single use: rotated on every refresh and revoked on
 *   sign-out) is kept in localStorage, so the customer stays signed in across tabs
 *   and visits. It is always read from storage, so a rotation done in another tab is
 *   picked up here.
 * - The access token (15 minutes) is kept in memory and in sessionStorage (this tab
 *   only). Reloading the page therefore reuses it instead of spending the refresh
 *   token: a reload or navigation that interrupted a refresh would otherwise lose
 *   the rotated token and end the session.
 *
 * Both are readable by scripts on this origin, as with the admin portal; production
 * hosting must send a strict Content-Security-Policy (see docs/DEPLOYMENT.md).
 */
import type { TokenPair } from '@/api/types';
import { storage } from '@/lib/storage';

export const REFRESH_KEY = 'alzaryab.customer.refresh';
export const ACCESS_KEY = 'alzaryab.customer.access';

let access: string | null = null;

const tabStorage = {
  get(): string | null {
    try {
      return window.sessionStorage?.getItem(ACCESS_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set(value: string | null) {
    try {
      if (value) window.sessionStorage?.setItem(ACCESS_KEY, value);
      else window.sessionStorage?.removeItem(ACCESS_KEY);
    } catch {
      /* storage unavailable: memory only */
    }
  },
};

/** { access, refresh } where access may be '' (none yet in this tab), or null when signed out. */
export async function loadTokens(): Promise<TokenPair | null> {
  const refresh = storage.get(REFRESH_KEY);
  if (!refresh) {
    access = null;
    tabStorage.set(null);
    return null;
  }
  access ??= tabStorage.get();
  return { access: access ?? '', refresh };
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  access = tokens.access;
  tabStorage.set(tokens.access);
  storage.set(REFRESH_KEY, tokens.refresh);
}

export async function clearTokens(): Promise<void> {
  access = null;
  tabStorage.set(null);
  storage.remove(REFRESH_KEY);
}

/** True while a refresh token is stored (cheap, synchronous check for the UI). */
export function hasStoredSession(): boolean {
  return !!storage.get(REFRESH_KEY);
}

/**
 * Runs fn while holding a lock shared by every tab of this site, so two tabs never
 * spend the same (single-use) refresh token at once. Falls back to no lock on
 * browsers without the Web Locks API.
 */
export async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return fn();
  return locks.request('alzaryab.customer.refresh', fn) as Promise<T>;
}
