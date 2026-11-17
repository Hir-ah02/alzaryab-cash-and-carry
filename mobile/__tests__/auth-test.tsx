import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';

import { apiRequest, setApiBaseUrl } from '@/api/client';
import { AuthProvider, PROFILE_KEY, useAuth } from '@/auth/AuthProvider';
import { clearTokens, loadTokens, resetTokenCacheForTests, saveTokens } from '@/auth/tokenStorage';
import { createQueryClient } from '@/lib/queryClient';

import { CUSTOMER, jsonResponse, mockFetch } from './helpers';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(async () => {
  setApiBaseUrl('http://test.local/api');
  await clearTokens();
  resetTokenCacheForTests();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('token storage', () => {
  it('keeps tokens in SecureStore and never in AsyncStorage', async () => {
    const asyncSet = jest.spyOn(AsyncStorage, 'setItem');
    await saveTokens({ access: 'a', refresh: 'r' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('alzaryab.customer.access', 'a');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('alzaryab.customer.refresh', 'r');
    expect(asyncSet).not.toHaveBeenCalled();

    resetTokenCacheForTests();
    expect(await loadTokens()).toEqual({ access: 'a', refresh: 'r' });
    await clearTokens();
    expect(await SecureStore.getItemAsync('alzaryab.customer.refresh')).toBeNull();
  });
});

describe('AuthProvider', () => {
  it('starts signed out without saved tokens', async () => {
    mockFetch(() => jsonResponse(200, {}));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.customer).toBeNull();
  });

  it('restores a saved session and refreshes the profile', async () => {
    await saveTokens({ access: 'a', refresh: 'r' });
    resetTokenCacheForTests();
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ ...CUSTOMER, firstName: 'Old' }));
    const calls = mockFetch(() => jsonResponse(200, CUSTOMER));

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.customer?.firstName).toBe('Ali'));
    expect(result.current.status).toBe('signedIn');
    expect(calls[0].url).toBe('http://test.local/api/customer/profile/');
    expect(calls[0].headers.Authorization).toBe('Bearer a');
  });

  it('stays signed in offline using the cached profile', async () => {
    await saveTokens({ access: 'a', refresh: 'r' });
    resetTokenCacheForTests();
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(CUSTOMER));
    mockFetch(() => {
      throw new TypeError('Network request failed');
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.customer?.name).toBe('Ali Raza');
  });

  it('signIn stores tokens securely; signOut removes them and revokes the refresh token', async () => {
    const calls = mockFetch((call) =>
      call.url.endsWith('/customer/auth/login/')
        ? jsonResponse(200, { access: 'acc', refresh: 'ref', user: CUSTOMER })
        : jsonResponse(204),
    );
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(() => result.current.signIn(' ali@example.com ', 'secret'));
    expect(calls[0].body).toEqual({ email: 'ali@example.com', password: 'secret' });
    expect(result.current.status).toBe('signedIn');
    expect(await SecureStore.getItemAsync('alzaryab.customer.access')).toBe('acc');
    expect(await AsyncStorage.getItem(PROFILE_KEY)).not.toContain('acc');

    await act(() => result.current.signOut());
    expect(result.current.status).toBe('signedOut');
    expect(await SecureStore.getItemAsync('alzaryab.customer.access')).toBeNull();
    expect(await AsyncStorage.getItem(PROFILE_KEY)).toBeNull();
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/customer/auth/logout/'))).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/customer/auth/logout/'))?.body).toEqual({ refresh: 'ref' });
  });

  it('wrong credentials give one clear message and no session', async () => {
    mockFetch(() => jsonResponse(401, { detail: 'Incorrect email or password.', code: 'invalid_credentials' }));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await expect(result.current.signIn('ali@example.com', 'nope')).rejects.toMatchObject({
      message: 'Incorrect email or password. Please try again.',
    });
    expect(await loadTokens()).toBeNull();
  });

  it('signs the customer out when the server ends the session', async () => {
    await saveTokens({ access: 'a', refresh: 'r' });
    resetTokenCacheForTests();
    let sessionValid = true;
    mockFetch(() => (sessionValid ? jsonResponse(200, CUSTOMER) : jsonResponse(401, { code: 'token_not_valid' })));
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.customer?.name).toBe('Ali Raza'));

    sessionValid = false;
    await act(async () => {
      await apiRequest('/customer/orders/', { auth: 'required' }).catch(() => {});
    });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.sessionExpired).toBe(true);
    expect(await SecureStore.getItemAsync('alzaryab.customer.refresh')).toBeNull();
  });
});
