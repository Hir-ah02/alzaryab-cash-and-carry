import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { STAFF_USER, installStorage, jsonResponse, mockFetch, signIn } from './testSupport.js';
import { MESSAGES } from './apiClient.js';
import { fetchCurrentUser, getSession, login, logout } from './authService.js';

const KEY = 'alzaryab.session';

beforeEach(() => installStorage());

describe('login', () => {
  test('posts the trimmed email and stores tokens in localStorage with "remember me"', async () => {
    const calls = mockFetch(() => jsonResponse(200, { access: 'a', refresh: 'r', user: STAFF_USER }));
    const session = await login('  owner@alzaryab.pk ', 'secret', true);

    assert.equal(calls[0].url, '/api/auth/login/');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, { email: 'owner@alzaryab.pk', password: 'secret' });
    assert.equal(calls[0].headers.Authorization, undefined);
    assert.deepEqual(session.user, STAFF_USER);
    assert.ok(localStorage.getItem(KEY));
    assert.equal(sessionStorage.getItem(KEY), null);
  });

  test('without "remember me" the session lives in sessionStorage only', async () => {
    signIn({ remember: true });
    mockFetch(() => jsonResponse(200, { access: 'a', refresh: 'r', user: STAFF_USER }));
    await login('owner@alzaryab.pk', 'secret', false);
    assert.ok(sessionStorage.getItem(KEY));
    assert.equal(localStorage.getItem(KEY), null);
  });

  test('wrong credentials give one message and store nothing', async () => {
    mockFetch(() => jsonResponse(401, { detail: 'Incorrect email or password.', code: 'invalid_credentials' }));
    const err = await login('owner@alzaryab.pk', 'nope').catch((e) => e);
    assert.equal(err.status, 401);
    assert.equal(err.message, 'Incorrect email or password. Please try again.');
    assert.equal(getSession(), null);
  });

  test('a non-admin account is refused with the server message', async () => {
    mockFetch(() => jsonResponse(403, { detail: "This account doesn't have access to the Admin Portal.", code: 'not_staff' }));
    const err = await login('member@example.com', 'secret').catch((e) => e);
    assert.equal(err.status, 403);
    assert.equal(err.message, "This account doesn't have access to the Admin Portal.");
  });

  test('network and throttling errors are reported plainly', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    assert.equal((await login('a@b.pk', 'x').catch((e) => e)).message, MESSAGES.network);
    mockFetch(() => jsonResponse(429, { detail: 'Request was throttled.' }));
    assert.equal((await login('a@b.pk', 'x').catch((e) => e)).message, MESSAGES.throttled);
  });
});

describe('session', () => {
  test('logout clears local state at once and revokes the refresh token', async () => {
    signIn({ refresh: 'refresh-1' });
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    logout();
    assert.equal(getSession(), null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls[0].url, '/api/auth/logout/');
    assert.deepEqual(calls[0].body, { refresh: 'refresh-1' });
  });

  test('old demo sessions and corrupt data are discarded', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 'demo-token', user: { name: 'Zaryab Khan' } }));
    sessionStorage.setItem(KEY, '{not json');
    assert.equal(getSession(), null);
    assert.equal(localStorage.getItem(KEY), null);
    assert.equal(sessionStorage.getItem(KEY), null);
  });

  test('fetchCurrentUser refreshes the stored user', async () => {
    signIn();
    mockFetch(() => jsonResponse(200, { ...STAFF_USER, name: 'New Name' }));
    const user = await fetchCurrentUser();
    assert.equal(user.name, 'New Name');
    assert.equal(getSession().user.name, 'New Name');
  });
});
