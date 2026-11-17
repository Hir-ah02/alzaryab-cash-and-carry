/** Customer sign-in endpoints. Tokens are stored by AuthProvider via tokenStorage (SecureStore). */
import { apiRequest } from './client';
import { ApiError } from './errors';
import type { AuthResponse, RegisterInput } from './types';

/** POST /customer/auth/login/  401 wrong details · 403 an admin account (must use the admin portal) */
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    return await apiRequest<AuthResponse>('/customer/auth/login/', {
      method: 'POST',
      body: { email: email.trim(), password },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new ApiError('Incorrect email or password. Please try again.', { status: 401, code: 'invalid_credentials' });
    }
    throw err;
  }
}

/** POST /customer/auth/register/  400 with fields.email / fields.password / fields.phone when invalid. */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/customer/auth/register/', {
    method: 'POST',
    body: { ...input, email: input.email.trim() },
  });
}

/** POST /customer/auth/logout/  Revokes the refresh token. Best effort: failures are ignored. */
export async function logout(refresh: string): Promise<void> {
  await apiRequest('/customer/auth/logout/', { method: 'POST', body: { refresh }, timeoutMs: 5000 }).catch(() => {});
}

/**
 * POST /customer/auth/password-reset/  Always the same answer, whether or not the account exists
 * (an active customer account gets an email with a 6-digit code).
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const data = await apiRequest<{ detail: string }>('/customer/auth/password-reset/', { method: 'POST', body: { email: email.trim() } });
  return data.detail;
}

/**
 * POST /customer/auth/password-reset/confirm/  Sets the new password. Every existing session
 * (on any device) ends. Wrong/expired code: ApiError code 'invalid_code'; weak password: fields.password.
 */
export async function confirmPasswordReset(input: { email: string; code: string; password: string }): Promise<string> {
  const data = await apiRequest<{ detail: string }>('/customer/auth/password-reset/confirm/', {
    method: 'POST',
    body: { email: input.email.trim(), code: input.code.trim(), password: input.password },
  });
  return data.detail;
}
