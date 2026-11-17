import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installStorage, jsonResponse, mockFetch, signIn } from './testSupport.js';
import { API_BASE, ApiError, MESSAGES, apiRequest, setSessionExpiredHandler } from './apiClient.js';
import { readSession } from './session.js';

let expiredCalls;

beforeEach(() => {
  installStorage();
  expiredCalls = 0;
  setSessionExpiredHandler(() => {
    expiredCalls += 1;
  });
});

describe('apiRequest', () => {
  test('sends the access token and JSON body to the API base', async () => {
    signIn();
    const calls = mockFetch(() => jsonResponse(201, { id: 7 }));
    const data = await apiRequest('/categories/', { method: 'POST', body: { name: 'Pet Food' } });

    assert.deepEqual(data, { id: 7 });
    assert.equal(API_BASE, '/api');
    assert.equal(calls[0].url, '/api/categories/');
    assert.equal(calls[0].headers.Authorization, 'Bearer access-1');
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
    assert.deepEqual(calls[0].body, { name: 'Pet Food' });
  });

  test('lets the browser set the multipart content type for FormData', async () => {
    signIn();
    const calls = mockFetch(() => jsonResponse(201, {}));
    await apiRequest('/products/', { method: 'POST', body: new FormData() });
    assert.equal(calls[0].headers['Content-Type'], undefined);
  });

  test('returns null for 204 No Content', async () => {
    signIn();
    mockFetch(() => new Response(null, { status: 204 }));
    assert.equal(await apiRequest('/products/1/', { method: 'DELETE' }), null);
  });

  test('turns a 400 into per-field messages', async () => {
    signIn();
    mockFetch(() => jsonResponse(400, { name: ['A product with this name and unit already exists.'], price: ['Ensure this value is greater than or equal to 0.01.'] }));
    const err = await apiRequest('/products/', { method: 'POST', body: {} }).catch((e) => e);
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 400);
    assert.equal(err.message, MESSAGES.invalid);
    assert.deepEqual(err.fields, {
      name: 'A product with this name and unit already exists.',
      price: 'Ensure this value is greater than or equal to 0.01.',
    });
  });

  test('uses a non-field 400 message when there is one', async () => {
    signIn();
    mockFetch(() => jsonResponse(400, { detail: 'This category still has 2 active product(s). Move or remove them first.' }));
    const err = await apiRequest('/categories/1/', { method: 'DELETE' }).catch((e) => e);
    assert.equal(err.message, 'This category still has 2 active product(s). Move or remove them first.');
  });

  test('never shows server internals for 5xx', async () => {
    signIn();
    mockFetch(() => new Response('Traceback (most recent call last): psycopg.OperationalError ...', { status: 500 }));
    const err = await apiRequest('/products/').catch((e) => e);
    assert.equal(err.status, 500);
    assert.equal(err.message, MESSAGES.server);
  });

  test('reports a network failure without signing the user out', async () => {
    signIn();
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const err = await apiRequest('/products/').catch((e) => e);
    assert.equal(err.status, 0);
    assert.equal(err.message, MESSAGES.network);
    assert.ok(readSession());
    assert.equal(expiredCalls, 0);
  });

  test('maps 403, 404, 409 and 429 to readable messages', async () => {
    signIn();
    for (const [status, message] of [
      [403, MESSAGES.forbidden],
      [404, MESSAGES.notFound],
      [409, MESSAGES.conflict],
      [429, MESSAGES.throttled],
    ]) {
      mockFetch(() => jsonResponse(status, {}));
      const err = await apiRequest('/x/').catch((e) => e);
      assert.equal(err.status, status);
      assert.equal(err.message, message);
    }
  });
});

describe('expired access tokens', () => {
  test('refreshes once, stores the rotated tokens and retries', async () => {
    signIn();
    const calls = mockFetch((call) => {
      if (call.url === '/api/auth/refresh/') return jsonResponse(200, { access: 'access-2', refresh: 'refresh-2' });
      return call.headers.Authorization === 'Bearer access-2'
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401, { code: 'token_not_valid' });
    });

    assert.deepEqual(await apiRequest('/products/'), { ok: true });
    assert.deepEqual(calls.map((c) => c.url), ['/api/products/', '/api/auth/refresh/', '/api/products/']);
    assert.deepEqual(calls[1].body, { refresh: 'refresh-1' });
    assert.equal(calls[1].headers.Authorization, undefined);
    const session = readSession();
    assert.equal(session.access, 'access-2');
    assert.equal(session.refresh, 'refresh-2');
    assert.ok(globalThis.localStorage.getItem('alzaryab.session'), 'stays in the remember-me storage');
  });

  test('parallel requests share a single refresh', async () => {
    signIn();
    const calls = mockFetch((call) => {
      if (call.url === '/api/auth/refresh/') return jsonResponse(200, { access: 'access-2', refresh: 'refresh-2' });
      return call.headers.Authorization === 'Bearer access-2' ? jsonResponse(200, {}) : jsonResponse(401, {});
    });
    await Promise.all([apiRequest('/a/'), apiRequest('/b/'), apiRequest('/c/')]);
    assert.equal(calls.filter((c) => c.url === '/api/auth/refresh/').length, 1);
  });

  test('ends the session when the refresh token is rejected', async () => {
    signIn();
    mockFetch(() => jsonResponse(401, { code: 'token_not_valid' }));
    const err = await apiRequest('/products/').catch((e) => e);
    assert.equal(err.status, 401);
    assert.equal(err.code, 'session_expired');
    assert.equal(err.message, MESSAGES.expired);
    assert.equal(readSession(), null);
    assert.equal(expiredCalls, 1);
  });

  test('keeps the session if the refresh request fails on the network', async () => {
    signIn();
    mockFetch((call) => {
      if (call.url === '/api/auth/refresh/') throw new TypeError('Failed to fetch');
      return jsonResponse(401, {});
    });
    const err = await apiRequest('/products/').catch((e) => e);
    assert.equal(err.message, MESSAGES.network);
    assert.ok(readSession());
    assert.equal(expiredCalls, 0);
  });

  test('uses tokens another tab already rotated', async () => {
    signIn();
    const calls = mockFetch((call) => {
      if (call.url === '/api/auth/refresh/') {
        // The other tab won the race: our refresh token is now blacklisted.
        signIn({ access: 'access-from-other-tab', refresh: 'refresh-from-other-tab' });
        return jsonResponse(401, {});
      }
      return call.headers.Authorization === 'Bearer access-from-other-tab' ? jsonResponse(200, { ok: 1 }) : jsonResponse(401, {});
    });
    assert.deepEqual(await apiRequest('/products/'), { ok: 1 });
    assert.equal(calls.length, 3);
    assert.equal(expiredCalls, 0);
  });

  test('without a session, fails fast and signs out', async () => {
    const calls = mockFetch(() => jsonResponse(200, {}));
    const err = await apiRequest('/products/').catch((e) => e);
    assert.equal(err.status, 401);
    assert.equal(calls.length, 0);
    assert.equal(expiredCalls, 1);
  });
});
