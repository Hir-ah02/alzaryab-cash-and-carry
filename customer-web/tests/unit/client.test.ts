import { beforeEach, describe, expect, it, vi } from 'vitest';

import { localStorage, sessionStorage } from './setup-browser';

import { apiRequest, setSessionExpiredHandler } from '@/api/client';
import { ApiError } from '@/api/errors';
import { ACCESS_KEY, clearTokens, loadTokens, REFRESH_KEY, saveTokens } from '@/auth/tokenStorage';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('token storage', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await clearTokens();
  });

  it('shares the refresh token across tabs but keeps the access token to this tab', async () => {
    await saveTokens({ access: 'A1', refresh: 'R1' });
    expect(localStorage.getItem(REFRESH_KEY)).toBe('R1');
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(sessionStorage.getItem(ACCESS_KEY)).toBe('A1');
    expect(await loadTokens()).toEqual({ access: 'A1', refresh: 'R1' });
  });

  it('clears both tokens on sign-out', async () => {
    await saveTokens({ access: 'A1', refresh: 'R1' });
    await clearTokens();
    expect(sessionStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(await loadTokens()).toBeNull();
  });

  it('picks up a refresh token rotated by another tab', async () => {
    await saveTokens({ access: 'A1', refresh: 'R1' });
    localStorage.setItem(REFRESH_KEY, 'R2');
    expect((await loadTokens())?.refresh).toBe('R2');
  });

  it('is signed out when another tab signed out', async () => {
    await saveTokens({ access: 'A1', refresh: 'R1' });
    localStorage.removeItem(REFRESH_KEY);
    expect(await loadTokens()).toBeNull();
  });
});

describe('apiRequest', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await clearTokens();
    vi.restoreAllMocks();
  });

  it('refuses authenticated calls when signed out, without a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(apiRequest('/customer/orders/', { auth: 'required' })).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('after a page load (no access token) refreshes first, once, for parallel calls', async () => {
    localStorage.setItem(REFRESH_KEY, 'R1');
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url} ${(init?.headers as Record<string, string>)?.Authorization ?? ''}`);
      if (url.endsWith('/customer/auth/refresh/')) return json(200, { access: 'A2', refresh: 'R2' });
      return json(200, { ok: true });
    });
    await Promise.all([apiRequest('/customer/profile/', { auth: 'required' }), apiRequest('/customer/orders/', { auth: 'required' })]);
    expect(calls.filter((c) => c.includes('/refresh/'))).toHaveLength(1);
    expect(calls.filter((c) => c.includes('Bearer A2'))).toHaveLength(2);
    expect(localStorage.getItem(REFRESH_KEY)).toBe('R2');
  });

  it('ends the session when the refresh token is rejected', async () => {
    await saveTokens({ access: 'OLD', refresh: 'R1' });
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/refresh/') ? json(401, { detail: 'Token is blacklisted' }) : json(401, { detail: 'expired' }),
    );
    await expect(apiRequest('/customer/orders/', { auth: 'required' })).rejects.toMatchObject({ code: 'session_expired' });
    expect(expired).toHaveBeenCalledOnce();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    setSessionExpiredHandler(null);
  });

  it('keeps the session on a network failure during refresh', async () => {
    await saveTokens({ access: 'OLD', refresh: 'R1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/refresh/')) throw new TypeError('Failed to fetch');
      return json(401, {});
    });
    await expect(apiRequest('/customer/orders/', { auth: 'required' })).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem(REFRESH_KEY)).toBe('R1');
  });

  it('turns order stock problems into ApiError.items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(400, { detail: 'Some items are unavailable.', items: [{ productId: 3, message: 'Only 2 left.', available: 2 }] }));
    const err = (await apiRequest('/catalog/products/').catch((e) => e)) as ApiError;
    expect(err.items).toEqual([{ productId: 3, message: 'Only 2 left.', available: 2 }]);
    expect(err.message).toBe('Some items are unavailable.');
  });
});
