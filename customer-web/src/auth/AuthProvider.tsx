// Adapted from mobile/src/auth/AuthProvider.tsx (browser storage, cross-tab sign-out).
/**
 * Customer session for the whole website.
 *
 * status:
 *   'restoring'  a stored session was found and is being checked with the server
 *   'signedIn'   session confirmed
 *   'signedOut'  no session
 *
 * The profile (name, email, phone) is not secret and is cached so pages render at once.
 */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { setSessionExpiredHandler } from '@/api/client';
import { getProfile } from '@/api/customer';
import { ApiError } from '@/api/errors';
import type { AuthResponse, Customer, RegisterInput } from '@/api/types';
import { resetCheckoutStore } from '@/checkout/checkoutStore';
import { queryKeys } from '@/lib/queryClient';
import { storage } from '@/lib/storage';

import { clearTokens, hasStoredSession, loadTokens, REFRESH_KEY, saveTokens } from './tokenStorage';

export const PROFILE_KEY = 'alzaryab.customer.profile';

export type AuthStatus = 'restoring' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  customer: Customer | null;
  /** True after the server ended the session (the sign-in page explains why). */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<Customer>;
  register: (input: RegisterInput) => Promise<Customer>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  applyProfile: (customer: Customer) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedProfile(): Customer | null {
  try {
    const raw = storage.get(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() => (hasStoredSession() ? 'restoring' : 'signedOut'));
  const [customer, setCustomer] = useState<Customer | null>(() => (hasStoredSession() ? readCachedProfile() : null));
  const [sessionExpired, setSessionExpired] = useState(false);

  const rememberCustomer = useCallback((next: Customer) => {
    setCustomer(next);
    storage.set(PROFILE_KEY, JSON.stringify(next));
  }, []);

  const forgetCustomer = useCallback(() => {
    setCustomer(null);
    setStatus('signedOut');
    queryClient.removeQueries({ queryKey: queryKeys.customer });
    storage.remove(PROFILE_KEY);
    resetCheckoutStore();
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    try {
      rememberCustomer(await getProfile());
      setStatus('signedIn');
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'not_authenticated' || err.code === 'session_expired')) {
        forgetCustomer();
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        // A staff account's session: it can't use the shop. Sign it out here.
        await clearTokens();
        forgetCustomer();
        return;
      }
      // Network or server problem: keep the session and the cached profile.
      if (hasStoredSession()) setStatus('signedIn');
    }
  }, [rememberCustomer, forgetCustomer]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSessionExpired(true);
      forgetCustomer();
    });
    return () => setSessionExpiredHandler(null);
  }, [forgetCustomer]);

  // Restore a stored session once at start-up.
  useEffect(() => {
    if (hasStoredSession()) void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signing in or out in another tab applies here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== REFRESH_KEY) return;
      if (!event.newValue) forgetCustomer();
      else if (event.oldValue === null) void refreshProfile(); // a new sign-in elsewhere
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [forgetCustomer, refreshProfile]);

  const startSession = useCallback(
    async ({ access, refresh, user }: AuthResponse) => {
      queryClient.removeQueries({ queryKey: queryKeys.customer }); // never show a previous customer's data
      await saveTokens({ access, refresh });
      rememberCustomer(user);
      setSessionExpired(false);
      setStatus('signedIn');
      return user;
    },
    [rememberCustomer, queryClient],
  );

  const signIn = useCallback(async (email: string, password: string) => startSession(await authApi.login(email, password)), [startSession]);
  const register = useCallback(async (input: RegisterInput) => startSession(await authApi.register(input)), [startSession]);

  const signOut = useCallback(async () => {
    const tokens = await loadTokens().catch(() => null);
    await clearTokens();
    setSessionExpired(false);
    forgetCustomer();
    if (tokens) void authApi.logout(tokens.refresh); // revoke on the server, best effort
  }, [forgetCustomer]);

  const value = useMemo(
    () => ({ status, customer, sessionExpired, signIn, register, signOut, refreshProfile, applyProfile: rememberCustomer }),
    [status, customer, sessionExpired, signIn, register, signOut, refreshProfile, rememberCustomer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
