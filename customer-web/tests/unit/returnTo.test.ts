import { describe, expect, it } from 'vitest';

import { loginPath, safeReturnPath } from '@/auth/returnTo';

describe('safeReturnPath', () => {
  it('accepts known in-site sections', () => {
    for (const p of ['/checkout', '/orders', '/orders/12', '/account/addresses', '/cart', '/products?search=rice']) expect(safeReturnPath(p)).toBe(p);
  });
  it('refuses other sites and unknown paths', () => {
    for (const p of ['https://evil.example', '//evil.example', '/\\evil.example', 'orders', '/admin', '/ordersX', '', null, undefined]) expect(safeReturnPath(p as string)).toBeNull();
  });
  it('builds a login link', () => {
    expect(loginPath('/checkout')).toBe('/login?next=%2Fcheckout');
    expect(loginPath('https://evil.example')).toBe('/login');
  });
});
