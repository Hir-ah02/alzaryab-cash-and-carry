// Adapted from mobile/src/api/client.ts. Web differences: same-origin base URL,
// the access token may be missing after a page load (it lives in memory only), and
// token refreshes are serialised across browser tabs (see auth/tokenStorage.ts).
/**
 * The one place the website talks to the Django API.
 *
 * - Every request times out (15 s by default).
 * - auth: 'required' sends the customer's access token. On a 401 (or when this tab
 *   has no access token yet) the token is refreshed once (one shared request, however
 *   many calls are waiting) and the call retried. If the session can't be renewed,
 *   tokens are deleted and the session-expired handler runs (AuthProvider signs out).
 * - Every failure becomes an ApiError with a message that is safe to show.
 */
import { clearTokens, loadTokens, saveTokens, withRefreshLock } from '@/auth/tokenStorage';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '@/config/api';

import { ApiError, MESSAGES, toApiError } from './errors';
import type { TokenPair } from './types';

export type AuthMode = 'none' | 'required';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: AuthMode;
  timeoutMs?: number;
  /** React Query passes this so leaving a page cancels its request. */
  signal?: AbortSignal;
}

let baseUrl: string | null = API_BASE_URL;
let onSessionExpired: () => void = () => {};

/** AuthProvider registers this to sign the customer out when the session can't be renewed. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler ?? (() => {});
}

/** For tests. */
export function setApiBaseUrl(url: string | null) {
  baseUrl = url;
}

async function send(path: string, { method = 'GET', body, token, timeoutMs = REQUEST_TIMEOUT_MS, signal }: RequestOptions & { token?: string }) {
  if (!baseUrl) throw new ApiError(MESSAGES.notConfigured, { code: 'not_configured' });

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit', // JWT in the header only; no cookies are used
    });
  } catch (err) {
    if (timedOut) throw new ApiError(MESSAGES.timeout, { code: 'timeout' });
    if (signal?.aborted) throw err; // cancelled by the caller: let React Query handle it
    throw new ApiError(MESSAGES.network, { code: 'network' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null; // e.g. an HTML error page from a proxy
  }
}

let refreshing: Promise<string | null> | null = null;

/**
 * New access token, or null if the session is over. Network/server failures throw
 * instead, so a blip doesn't sign anyone out. The refresh token is read inside the
 * cross-tab lock, so a token another tab has just rotated is used, not the spent one.
 */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = withRefreshLock(async () => {
      const current = await loadTokens();
      if (!current) return null; // signed out (possibly in another tab)
      const res = await send('/customer/auth/refresh/', { method: 'POST', body: { refresh: current.refresh } });
      const data = await readJson(res);
      if (res.ok) {
        const tokens = data as TokenPair;
        await saveTokens({ access: tokens.access, refresh: tokens.refresh ?? current.refresh });
        return tokens.access;
      }
      if (res.status === 400 || res.status === 401) return null;
      throw toApiError(res.status, data);
    }).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function endSession(): Promise<ApiError> {
  await clearTokens();
  onSessionExpired();
  return new ApiError(MESSAGES.expired, { status: 401, code: 'session_expired' });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = 'none' } = options;
  let res: Response;

  if (auth === 'required') {
    const tokens = await loadTokens();
    if (!tokens) throw new ApiError('Please sign in to continue.', { status: 401, code: 'not_authenticated' });

    let access: string | null = tokens.access;
    if (!access) {
      access = await refreshAccessToken();
      if (!access) throw await endSession();
    }
    res = await send(path, { ...options, token: access });
    if (res.status === 401) {
      access = await refreshAccessToken();
      if (!access) throw await endSession();
      res = await send(path, { ...options, token: access });
      if (res.status === 401) throw await endSession();
    }
  } else {
    res = await send(path, options);
  }

  const data = await readJson(res);
  if (!res.ok) throw toApiError(res.status, data);
  return data as T;
}
