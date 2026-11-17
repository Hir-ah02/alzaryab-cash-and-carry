import * as SecureStore from 'expo-secure-store';

import { apiRequest, setApiBaseUrl, setSessionExpiredHandler } from '@/api/client';
import { ApiError, MESSAGES } from '@/api/errors';
import { clearTokens, loadTokens, resetTokenCacheForTests, saveTokens } from '@/auth/tokenStorage';

import { jsonResponse, mockFetch } from './helpers';

const BASE = 'http://test.local/api';
let expired = 0;

beforeEach(async () => {
  setApiBaseUrl(BASE);
  expired = 0;
  setSessionExpiredHandler(() => {
    expired += 1;
  });
  await clearTokens();
  resetTokenCacheForTests();
});

async function signIn(access = 'access-1', refresh = 'refresh-1') {
  await saveTokens({ access, refresh });
}

describe('requests', () => {
  it('builds the URL, sends JSON and parses the response', async () => {
    const calls = mockFetch(() => jsonResponse(201, { id: 3 }));
    await expect(apiRequest('/customer/addresses/', { method: 'POST', body: { city: 'Lahore' } })).resolves.toEqual({ id: 3 });
    expect(calls[0].url).toBe('http://test.local/api/customer/addresses/');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].body).toEqual({ city: 'Lahore' });
  });

  it('returns null for empty bodies (204)', async () => {
    mockFetch(() => jsonResponse(204));
    await expect(apiRequest('/x/', { method: 'DELETE' })).resolves.toBeNull();
  });

  it('refuses to send when no server is configured', async () => {
    setApiBaseUrl(null);
    const calls = mockFetch(() => jsonResponse(200, {}));
    await expect(apiRequest('/x/')).rejects.toMatchObject({ code: 'not_configured', message: MESSAGES.notConfigured });
    expect(calls).toHaveLength(0);
  });
});

describe('errors', () => {
  it('reports network failures plainly', async () => {
    mockFetch(() => {
      throw new TypeError('Network request failed');
    });
    const err = (await apiRequest('/x/').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('network');
    expect(err.isNetworkError).toBe(true);
    expect(err.message).toBe(MESSAGES.network);
  });

  it('times out slow requests', async () => {
    globalThis.fetch = jest.fn(
      (_url, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
        }),
    ) as typeof fetch;
    const err = (await apiRequest('/x/', { timeoutMs: 20 }).catch((e) => e)) as ApiError;
    expect(err.code).toBe('timeout');
    expect(err.message).toBe(MESSAGES.timeout);
  });

  it('turns 400 bodies into field messages and order problems', async () => {
    mockFetch(() =>
      jsonResponse(400, {
        detail: 'Some items in your order need attention.',
        items: [{ productId: 3, message: 'Only 2 left in stock.', available: 2 }],
      }),
    );
    const orderErr = (await apiRequest('/customer/orders/', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;
    expect(orderErr.message).toBe('Some items in your order need attention.');
    expect(orderErr.items).toEqual([{ productId: 3, message: 'Only 2 left in stock.', available: 2 }]);

    mockFetch(() => jsonResponse(400, { email: ['An account with this email already exists.'], password: ['Too short.', 'Too common.'] }));
    const formErr = (await apiRequest('/customer/auth/register/', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;
    expect(formErr.message).toBe(MESSAGES.invalid);
    expect(formErr.fields).toEqual({ email: 'An account with this email already exists.', password: 'Too short.' });
  });

  it('never shows server internals for 5xx or non-JSON bodies', async () => {
    mockFetch(() => jsonResponse(500, '<html>Traceback: psycopg.OperationalError</html>'));
    const err = (await apiRequest('/x/').catch((e) => e)) as ApiError;
    expect(err.status).toBe(500);
    expect(err.message).toBe(MESSAGES.server);
  });

  it.each([
    [403, MESSAGES.forbidden],
    [404, MESSAGES.notFound],
    [429, MESSAGES.throttled],
  ])('maps %i to a readable message', async (status, message) => {
    mockFetch(() => jsonResponse(status, {}));
    await expect(apiRequest('/x/')).rejects.toMatchObject({ status, message });
  });
});

describe('authenticated requests', () => {
  it('requires a session for customer endpoints', async () => {
    const calls = mockFetch(() => jsonResponse(200, {}));
    await expect(apiRequest('/customer/profile/', { auth: 'required' })).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(calls).toHaveLength(0);
    expect(expired).toBe(0);
  });

  it('sends the access token', async () => {
    await signIn();
    const calls = mockFetch(() => jsonResponse(200, { ok: true }));
    await apiRequest('/customer/profile/', { auth: 'required' });
    expect(calls[0].headers.Authorization).toBe('Bearer access-1');
  });

  it('refreshes an expired access token once, stores the rotated tokens and retries', async () => {
    await signIn();
    const calls = mockFetch((call) => {
      if (call.url.endsWith('/customer/auth/refresh/')) return jsonResponse(200, { access: 'access-2', refresh: 'refresh-2' });
      return call.headers.Authorization === 'Bearer access-2' ? jsonResponse(200, { ok: true }) : jsonResponse(401, { code: 'token_not_valid' });
    });

    await expect(apiRequest('/customer/profile/', { auth: 'required' })).resolves.toEqual({ ok: true });
    expect(calls.map((c) => c.url.replace(BASE, ''))).toEqual(['/customer/profile/', '/customer/auth/refresh/', '/customer/profile/']);
    expect(calls[1].body).toEqual({ refresh: 'refresh-1' });
    expect(await SecureStore.getItemAsync('alzaryab.customer.refresh')).toBe('refresh-2');
  });

  it('shares one refresh between parallel requests', async () => {
    await signIn();
    const calls = mockFetch((call) => {
      if (call.url.endsWith('/customer/auth/refresh/')) return jsonResponse(200, { access: 'access-2', refresh: 'refresh-2' });
      return call.headers.Authorization === 'Bearer access-2' ? jsonResponse(200, {}) : jsonResponse(401, {});
    });
    await Promise.all([1, 2, 3].map((n) => apiRequest(`/customer/orders/${n}/`, { auth: 'required' })));
    expect(calls.filter((c) => c.url.endsWith('/customer/auth/refresh/'))).toHaveLength(1);
  });

  it('ends the session and deletes tokens when the refresh token is rejected', async () => {
    await signIn();
    mockFetch(() => jsonResponse(401, { code: 'token_not_valid' }));
    await expect(apiRequest('/customer/orders/', { auth: 'required' })).rejects.toMatchObject({ code: 'session_expired', status: 401 });
    expect(expired).toBe(1);
    resetTokenCacheForTests();
    expect(await loadTokens()).toBeNull();
  });

  it('keeps the session when the refresh fails on the network', async () => {
    await signIn();
    mockFetch((call) => {
      if (call.url.endsWith('/customer/auth/refresh/')) throw new TypeError('Network request failed');
      return jsonResponse(401, {});
    });
    await expect(apiRequest('/customer/orders/', { auth: 'required' })).rejects.toMatchObject({ code: 'network' });
    expect(expired).toBe(0);
    expect(await loadTokens()).toEqual({ access: 'access-1', refresh: 'refresh-1' });
  });
});
