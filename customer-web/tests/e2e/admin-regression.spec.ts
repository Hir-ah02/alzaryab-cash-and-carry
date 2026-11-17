import { expect, test } from '@playwright/test';

import { adminLogin, ADMIN, API, productByName, registerApi } from './helpers';

test.describe('Existing admin portal still works (regression)', () => {
  test('staff login, dashboard, products and orders pages', async ({ page, request }) => {
    // A website order to look for (this spec runs first, before any other order exists).
    const customer = await registerApi(request, 'admin-check');
    const headers = { Authorization: `Bearer ${customer.access}` };
    const rice = await productByName(request, 'E2E Basmati Rice');
    const addr = await request.post(`${API}/customer/addresses/`, {
      headers,
      data: { recipientName: 'Admin Check', phone: '03004445566', line1: 'Street 2', area: 'I-8', city: 'Islamabad', label: '', line2: '', postalCode: '', instructions: '' },
    });
    const placed = await request.post(`${API}/customer/orders/`, { headers, data: { items: [{ productId: rice.id, quantity: 1 }], addressId: (await addr.json()).id } });
    expect(placed.status()).toBe(201);
    const { reference } = await placed.json();

    await adminLogin(page);
    await expect(page.getByText(/Total Products|Low Stock/).first()).toBeVisible();
    await page.goto(`${ADMIN}/#/products`);
    await expect(page.getByText('E2E Basmati Rice').first()).toBeVisible();
    await expect(page.getByText('E2E Hidden Biscuits').first()).toBeVisible(); // admins still see hidden products
    await page.goto(`${ADMIN}/#/orders`);
    await expect(page.getByLabel('Search orders')).toBeVisible();
    await expect(page.getByRole('link', { name: `View order ${reference}` })).toBeVisible();
  });

  test('a customer account cannot use the admin portal', async ({ page, request }) => {
    const customer = await registerApi(request, 'not-admin');
    await page.goto(`${ADMIN}/#/login`);
    await page.getByLabel('Email Address').fill(customer.email);
    await page.getByPlaceholder('Enter your password').fill(customer.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByRole('alert').first()).toBeVisible();
  });
});
