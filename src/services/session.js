/**
 * Stores the signed-in session: { access, refresh, user }.
 *
 * "Remember me" keeps it in localStorage (survives closing the browser);
 * otherwise it lives in sessionStorage (cleared when the tab closes).
 * Only one storage ever holds the session.
 *
 * Development setup: tokens are readable by page scripts. See README.md
 * ("Production security") for the httpOnly-cookie setup to use in production.
 */

export const SESSION_KEY = 'alzaryab.session';

function stores() {
  return [globalThis.localStorage, globalThis.sessionStorage].filter(Boolean);
}

function isValid(session) {
  return Boolean(session && typeof session.access === 'string' && typeof session.refresh === 'string' && session.user);
}

function find() {
  for (const storage of stores()) {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) continue;
    try {
      const session = JSON.parse(raw);
      if (isValid(session)) return { storage, session };
    } catch {
      // fall through and drop it
    }
    // Corrupt, or left over from the old demo login: discard.
    storage.removeItem(SESSION_KEY);
  }
  return null;
}

export function readSession() {
  return find()?.session ?? null;
}

export function saveSession(session, remember) {
  clearSession();
  const storage = remember ? globalThis.localStorage : globalThis.sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

/** Merges new tokens or user details into the stored session, wherever it lives. */
export function updateSession(changes) {
  const found = find();
  if (!found) return null;
  const next = { ...found.session, ...changes };
  found.storage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearSession() {
  stores().forEach((storage) => storage.removeItem(SESSION_KEY));
}
