/**
 * Admin authentication against the Django API (JWT).
 *
 *   POST /auth/login/    { email, password } → { access, refresh, user }
 *   POST /auth/refresh/  handled by apiClient when an access token expires
 *   POST /auth/logout/   { refresh } → blacklists the refresh token
 *   GET  /auth/me/       the signed-in admin
 *
 * Only active staff accounts can sign in. Accounts are created on the
 * server (see backend/README.md); there are no credentials in this app.
 */
import { ApiError, apiRequest } from './apiClient.js';
import { clearSession, readSession, saveSession, updateSession } from './session.js';

export async function login(email, password, remember = false) {
  let data;
  try {
    data = await apiRequest('/auth/login/', {
      method: 'POST',
      body: { email: String(email).trim(), password },
      auth: false,
    });
  } catch (err) {
    if (err.status === 401) {
      throw new ApiError('Incorrect email or password. Please try again.', { status: 401, code: 'invalid_credentials' });
    }
    if (err.status === 400) {
      throw new ApiError('Enter a valid email address and password.', { status: 400, code: 'invalid' });
    }
    throw err; // 403 not an admin, 429 too many attempts, network or server errors
  }

  const session = { access: data.access, refresh: data.refresh, user: data.user, createdAt: new Date().toISOString() };
  saveSession(session, remember);
  return session;
}

/** Signs out locally at once, then revokes the refresh token on the server (best effort). */
export function logout() {
  const session = readSession();
  clearSession();
  if (session?.refresh) {
    apiRequest('/auth/logout/', { method: 'POST', body: { refresh: session.refresh }, auth: false }).catch(() => {});
  }
}

export function getSession() {
  return readSession();
}

/** Reloads the signed-in admin's details (and confirms the session is still valid). */
export async function fetchCurrentUser() {
  const user = await apiRequest('/auth/me/');
  updateSession({ user });
  return user;
}
