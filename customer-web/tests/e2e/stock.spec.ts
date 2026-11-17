import { expect, test } from '@playwright/test';

import { addFromProductPage, API, customerOrders, fillAddress, loginCustomerApi, patchProduct, productByName, registerApi, registerUi, staffToken } from './helpers';

async function goToCheckoutWithAddress(page: import('@playwright/test').Page) {
  await page.goto('/checkout');
  const save = page.getByRole('button', { name: 'Save and use this address' });
  // Wait until saved addresses have loaded: either the address list or the new-address form.
  await expect(page.getByRole('radio', { name: /Ayesha Khan/ }).or(save)).toBeVisible();
  if (await save.isVisible()) {
    await fillAddress(page);
    await page.getByRole('button', { name: 'Save and use this address' }).click();
  }
  await expect(page.getByRole('radio', { name: /Ayesha Khan/ })).toBeChecked();
}

test.describe('Stock and price validation (enforced by the backend)', () => {
  test('insufficient stock is reported at checkout and can be fixed', async ({ page }) => {
    await registerUi(page);
    await addFromProductPage(page, 'E2E Sunflower Oil', 5); // only 3 in stock
    await goToCheckoutWithAddress(page);
    const problems = page.getByTestId('stock-problems');
    await expect(problems).toContainText('E2E Sunflower Oil');
    await expect(page.getByTestId('place-order')).toBeDisabled();
    await problems.getByRole('button', { name: 'Change to 3' }).click();
    await expect(problems).toHaveCount(0);
    await expect(page.getByTestId('order-total')).toHaveText('Rs. 1,950'); // 3×600 + 150
    await expect(page.getByTestId('place-order')).toBeEnabled();
  });

  test('product going out of stock after being added to the cart', async ({ page, request }) => {
    const token = await staffToken(request);
    const water = await productByName(request, 'E2E Mineral Water');
    await page.goto('/');
    await addFromProductPage(page, 'E2E Mineral Water', 2);
    await addFromProductPage(page, 'E2E Basmati Rice', 1);
    await patchProduct(request, token, water.id, { stock: 0 });
    try {
      await page.goto('/cart');
      await expect(page.getByTestId('cart-issues')).toContainText('E2E Mineral Water is out of stock and will be removed.');
      await expect(page.getByTestId('go-to-checkout')).toBeDisabled();
      await page.getByTestId('accept-cart-changes').click();
      await expect(page.getByTestId('cart-line')).toHaveCount(1);
      await expect(page.getByTestId('go-to-checkout')).toBeEnabled();
    } finally {
      await patchProduct(request, token, water.id, { stock: 40 });
    }
  });

  test('price change in the cart must be accepted', async ({ page, request }) => {
    const token = await staffToken(request);
    const tea = await productByName(request, 'E2E Green Tea');
    await addFromProductPage(page, 'E2E Green Tea', 1);
    await patchProduct(request, token, tea.id, { price: '400.00' });
    try {
      await page.goto('/cart');
      await expect(page.getByTestId('cart-issues')).toContainText('E2E Green Tea is now Rs. 400 (was Rs. 350).');
      await page.getByTestId('accept-cart-changes').click();
      await expect(page.getByText('Rs. 400 each')).toBeVisible();
    } finally {
      await patchProduct(request, token, tea.id, { price: '350.00' });
    }
  });

  test('price change between quote and Place order is caught', async ({ page, request }) => {
    const token = await staffToken(request);
    const tea = await productByName(request, 'E2E Green Tea');
    const customer = await registerUi(page);
    await addFromProductPage(page, 'E2E Green Tea', 2);
    await goToCheckoutWithAddress(page);
    await expect(page.getByTestId('order-total')).toHaveText('Rs. 850'); // 2×350 + 150
    await patchProduct(request, token, tea.id, { price: '375.00' });
    try {
      await page.getByTestId('place-order').click();
      // Cart check sees the new price first: the customer has to accept it before anything is ordered.
      await expect(page.getByTestId('cart-issues')).toContainText('E2E Green Tea is now Rs. 375 (was Rs. 350).');
      const access = await loginCustomerApi(request, customer.email, customer.password);
      expect((await customerOrders(request, access)).count).toBe(0);
      await page.getByTestId('accept-cart-changes').click();
      await expect(page.getByTestId('order-total')).toHaveText('Rs. 900'); // 2×375 + 150
      await page.getByTestId('place-order').click();
      await expect(page.getByTestId('order-confirmation')).toBeVisible();
      const orders = await customerOrders(request, access);
      expect(orders.count).toBe(1);
      expect(orders.results[0].total).toBe('900.00');
    } finally {
      await patchProduct(request, token, tea.id, { price: '350.00' });
    }
  });

  test('concurrent orders for the last item: exactly one succeeds', async ({ request }) => {
    const honey = await productByName(request, 'E2E Last Honey Jar');
    const [a, b] = await Promise.all([registerApi(request, 'race-a'), registerApi(request, 'race-b')]);
    const address = { recipientName: 'Race', phone: '03001234567', line1: 'Street 1', area: 'F-7', city: 'Islamabad', label: '', line2: '', postalCode: '', instructions: '' };
    const addressIds = await Promise.all(
      [a, b].map(async (c) => {
        const res = await request.post(`${API}/customer/addresses/`, { data: address, headers: { Authorization: `Bearer ${c.access}` } });
        expect(res.status()).toBe(201);
        return (await res.json()).id as number;
      }),
    );
    const results = await Promise.all(
      [a, b].map((c, i) =>
        request.post(`${API}/customer/orders/`, {
          data: { items: [{ productId: honey.id, quantity: 1 }], addressId: addressIds[i], paymentMethod: 'cash_on_delivery', requestId: crypto.randomUUID() },
          headers: { Authorization: `Bearer ${c.access}` },
        }),
      ),
    );
    const statuses = results.map((r) => r.status()).sort();
    expect(statuses).toEqual([201, 400]);
    const rejected = results.find((r) => r.status() === 400)!;
    expect((await rejected.json()).items[0].productId).toBe(honey.id);
    expect((await productByName(request, 'E2E Last Honey Jar')).inStock).toBe(false);
  });

  test('lost connection while placing: retry returns the same order, never a duplicate', async ({ page, request }) => {
    const customer = await registerUi(page);
    await addFromProductPage(page, 'E2E Basmati Rice', 1);
    await goToCheckoutWithAddress(page);
    // The request reaches the server (order created) but the answer is lost: the exact
    // request is forwarded to Django, and the browser gets a proxy's 502 instead of the 201.
    const forwarded: string[] = [];
    await page.route('**/api/customer/orders/', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const sent = route.request();
      try {
        const real = await request.post(`${API}/customer/orders/`, {
          data: sent.postDataJSON(),
          headers: { Authorization: (await sent.allHeaders()).authorization ?? '' },
        });
        forwarded.push(`${real.status()} ${(await real.text()).slice(0, 200)}`);
      } catch (err) {
        forwarded.push(`error ${String(err)}`);
      }
      await route.fulfill({ status: 502, body: '<html>Bad gateway</html>', contentType: 'text/html' });
    });
    await page.getByTestId('place-order').click();
    await expect(page.getByText("We couldn't confirm your order")).toBeVisible();
    await expect(page.getByText('The connection dropped before Al Zaryab answered.')).toBeVisible();
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0]).toMatch(/^201 /);
    await page.unroute('**/api/customer/orders/');
    // Still pending after a reload (requestId kept in the browser).
    await page.reload();
    await expect(page.getByText("We couldn't confirm your order")).toBeVisible();
    await page.getByTestId('retry-order').click();
    await expect(page.getByTestId('order-confirmation')).toBeVisible();
    const access = await loginCustomerApi(request, customer.email, customer.password);
    expect((await customerOrders(request, access)).count).toBe(1);
  });
});
