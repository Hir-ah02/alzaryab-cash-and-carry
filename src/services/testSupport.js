/**
 * Helpers for the service tests (node --test). Not imported by the app.
 * Provides in-memory localStorage/sessionStorage and a scripted fetch.
 */

class MemoryStorage {
  #data = new Map();
  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }
  setItem(key, value) {
    this.#data.set(key, String(value));
  }
  removeItem(key) {
    this.#data.delete(key);
  }
  clear() {
    this.#data.clear();
  }
}

export function installStorage() {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true });
  }
}

export function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Replaces global fetch. `handler(call)` returns a Response (or throws to
 * simulate a network failure). Every call is recorded with its parsed body.
 */
export function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = {
      url,
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      rawBody: init.body,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
    };
    calls.push(call);
    return handler(call, calls.length);
  };
  return calls;
}

export const STAFF_USER = { id: 1, username: 'owner', email: 'owner@alzaryab.pk', name: 'Zaryab Khan', initials: 'ZK', role: 'Owner' };

export function signIn({ access = 'access-1', refresh = 'refresh-1', remember = true } = {}) {
  const storage = remember ? globalThis.localStorage : globalThis.sessionStorage;
  storage.setItem('alzaryab.session', JSON.stringify({ access, refresh, user: STAFF_USER }));
}
