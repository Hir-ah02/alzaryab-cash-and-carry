/**
 * Customer session for the whole app.
 *
 * status:
 *   'restoring'  checking the keychain at startup
 *   'signedIn'   tokens present (profile shown from the last known copy, then refreshed)
 *   'signedOut'  no session
 *
 * Tokens: SecureStore only (tokenStorage). The profile (name, email, phone)
 * is not secret and is cached in AsyncStorage so the app opens instantly offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '@/api/auth';
import { setSessionExpiredHandler } from '@/api/client';
import { getProfile } from '@/api/customer';
import { ApiError } from '@/api/errors';
import type { AuthResponse, Customer, RegisterInput } from '@/api/types';
import { queryKeys } from '@/lib/queryClient';

import { clearTokens, loadTokens, saveTokens } from './tokenStorage';

export const PROFILE_KEY = 'alzaryab.customer.profile';

export type AuthStatus = 'restoring' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  customer: Customer | null;
  /** True after the server ended the session (the sign-in screen can explain why). */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<Customer>;
  register: (input: RegisterInput) => Promise<Customer>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Shows a profile the server just returned (e.g. after PATCH /customer/profile/). */
  applyProfile: (customer: Customer) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readCachedProfile(): Promise<Customer | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const rememberCustomer = useCallback(async (next: Customer) => {
    setCustomer(next);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const forgetCustomer = useCallback(async () => {
    setCustomer(null);
    setStatus('signedOut');
    queryClient.removeQueries({ queryKey: queryKeys.customer });
    await AsyncStorage.removeItem(PROFILE_KEY).catch(() => {});
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    try {
      await rememberCustomer(await getProfile());
    } catch (err) {
      // Network problems keep the cached profile; an ended session is handled by the expired handler.
      if (err instanceof ApiError && err.code === 'not_authenticated') await forgetCustomer();
    }
  }, [rememberCustomer, forgetCustomer]);

  // Any request that finds the session can't be renewed signs the customer out here.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSessionExpired(true);
      void forgetCustomer();
    });
    return () => setSessionExpiredHandler(null);
  }, [forgetCustomer]);

  // Restore the session at startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await loadTokens().catch(() => null);
      if (cancelled) return;
      if (!tokens) {
        setStatus('signedOut');
        return;
      }
      const cached = await readCachedProfile();
      if (cancelled) return;
      if (cached) setCustomer(cached);
      setStatus('signedIn');
      await refreshProfile();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  const startSession = useCallback(
    async ({ access, refresh, user }: AuthResponse) => {
      await saveTokens({ access, refresh });
      await rememberCustomer(user);
      setSessionExpired(false);
      setStatus('signedIn');
      return user;
    },
    [rememberCustomer],
  );

  const signIn = useCallback(
    async (email: string, password: string) => startSession(await authApi.login(email, password)),
    [startSession],
  );

  const register = useCallback(async (input: RegisterInput) => startSession(await authApi.register(input)), [startSession]);

  const signOut = useCallback(async () => {
    const tokens = await loadTokens().catch(() => null);
    await clearTokens();
    setSessionExpired(false);
    await forgetCustomer();
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
