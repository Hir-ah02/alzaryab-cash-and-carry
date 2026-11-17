import { expect, test } from '@playwright/test';

import { API, loginUi, productByName, registerApi, staffToken } from './helpers';

async function placeOrderApi(request: import('@playwright/test').APIRequestContext, access: string) {
  const rice = await productByName(request, 'E2E Basmati Rice');
  const headers = { Authorization: `Bearer ${access}` };
  const addr = await request.post(`${API}/customer/addresses/`, {
    headers,
    data: { recipientName: 'Owner', phone: '03001112233', line1: 'Street 9', area: 'F-6', city: 'Islamabad', label: '', line2: '', postalCode: '', instructions: '' },
  });
  expect(addr.status()).toBe(201);
  const res = await request.post(`${API}/customer/orders/`, {
    headers,
    data: { items: [{ productId: rice.id, quantity: 1 }], addressId: (await addr.json()).id, requestId: crypto.randomUUID() },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: number; reference: string };
}

test.describe('Authorization and data isolation', () => {
  test("a customer cannot see or cancel another customer's order", async ({ page, request }) => {
    const owner = await registerApi(request, 'owner');
    const other = await registerApi(request, 'other');
    const order = await placeOrderApi(request, owner.access);

    // Website: the other customer gets "Order not found"
    await loginUi(page, other.email, other.password);
    await expect(page.getByTestId('account-menu')).toBeVisible();
    await page.goto(`/orders/${order.id}`);
    await expect(page.getByRole('heading', { name: 'Order not found' })).toBeVisible();
    await expect(page.getByText(order.reference)).toHaveCount(0);

    // API: 404 for read and cancel; the order is unchanged
    const asOther = { Authorization: `Bearer ${other.access}` };
    expect((await request.get(`${API}/customer/orders/${order.id}/`, { headers: asOther })).status()).toBe(404);
    expect((await request.post(`${API}/customer/orders/${order.id}/cancel/`, { headers: asOther, data: {} })).status()).toBe(404);
    const mine = await request.get(`${API}/customer/orders/${order.id}/`, { headers: { Authorization: `Bearer ${owner.access}` } });
    expect((await mine.json()).status).toBe('pending');

    // Another customer's address can't be used either
    const ownerAddresses = await (await request.get(`${API}/customer/addresses/`, { headers: { Authorization: `Bearer ${owner.access}` } })).json();
    const rice = await productByName(request, 'E2E Basmati Rice');
    const stolen = await request.post(`${API}/customer/orders/`, {
      headers: asOther,
      data: { items: [{ productId: rice.id, quantity: 1 }], addressId: ownerAddresses[0].id, requestId: crypto.randomUUID() },
    });
    expect(stolen.status()).toBe(400);
  });

  test('roles are separated and anonymous requests are refused', async ({ request }) => {
    const customer = await registerApi(request, 'roles');
    const staff = await staffToken(request);
    expect((await request.get(`${API}/customer/orders/`)).status()).toBe(401);
    expect((await request.get(`${API}/customer/orders/`, { headers: { Authorization: `Bearer ${staff}` } })).status()).toBe(403);
    expect((await request.get(`${API}/orders/`, { headers: { Authorization: `Bearer ${customer.access}` } })).status()).toBe(403);
    expect((await request.get(`${API}/products/`, { headers: { Authorization: `Bearer ${customer.access}` } })).status()).toBe(403);
    // Prices can't be set by the client: an injected price is ignored
    const rice = await productByName(request, 'E2E Basmati Rice');
    const quote = await request.post(`${API}/customer/orders/quote/`, {
      headers: { Authorization: `Bearer ${customer.access}` },
      data: { items: [{ productId: rice.id, quantity: 1, price: '1.00' }] },
    });
    expect((await quote.json()).subtotal).toBe('1500.00');
  });

  test('an ended session sends the customer back to sign in', async ({ page, request }) => {
    const customer = await registerApi(request, 'expired');
    await loginUi(page, customer.email, customer.password);
    await expect(page.getByTestId('account-menu')).toBeVisible();
    // Simulate the server ending the session (e.g. password reset): both tokens become invalid.
    await page.evaluate(() => {
      localStorage.setItem('alzaryab.customer.refresh', 'revoked-token');
      sessionStorage.setItem('alzaryab.customer.access', 'revoked-token');
    });
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    await expect(page.getByText('Your session has ended. Please sign in again.')).toBeVisible();
  });
});
