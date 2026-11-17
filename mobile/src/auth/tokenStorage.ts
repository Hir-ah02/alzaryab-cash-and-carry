/**
 * The customer's JWTs live only in the device keychain / keystore
 * (expo-secure-store), never in AsyncStorage. A copy is kept in memory so
 * each request doesn't have to read the keychain.
 */
import * as SecureStore from 'expo-secure-store';

import type { TokenPair } from '@/api/types';

const ACCESS_KEY = 'alzaryab.customer.access';
const REFRESH_KEY = 'alzaryab.customer.refresh';

let cache: TokenPair | null | undefined; // undefined = not read from the keychain yet

export async function loadTokens(): Promise<TokenPair | null> {
  if (cache !== undefined) return cache;
  const [access, refresh] = await Promise.all([SecureStore.getItemAsync(ACCESS_KEY), SecureStore.getItemAsync(REFRESH_KEY)]);
  cache = access && refresh ? { access, refresh } : null;
  return cache;
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  cache = tokens;
  await Promise.all([SecureStore.setItemAsync(ACCESS_KEY, tokens.access), SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh)]);
}

export async function clearTokens(): Promise<void> {
  cache = null;
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}

/** Test helper: forget the in-memory copy so the next load reads the keychain. */
export function resetTokenCacheForTests() {
  cache = undefined;
}
