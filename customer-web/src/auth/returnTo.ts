/**
 * Where to go after signing in (?next=/checkout). Only paths inside this site that
 * start with a known section are accepted, so a crafted link can't redirect the
 * customer to another website.
 */
const ALLOWED_PREFIXES = ['/checkout', '/orders', '/account', '/cart', '/products'];

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return ALLOWED_PREFIXES.some((p) => value === p || value.startsWith(`${p}/`) || value.startsWith(`${p}?`)) ? value : null;
}

export function loginPath(next: string) {
  const safe = safeReturnPath(next);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : '/login';
}
