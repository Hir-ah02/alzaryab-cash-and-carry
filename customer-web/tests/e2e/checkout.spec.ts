import { expect, test } from '@playwright/test';

import { addFromProductPage, adminLogin, ADMIN, API, customerOrders, fillAddress, loginCustomerApi, productByName, registerUi } from './helpers';

test.describe('Full order journey: website → admin portal → website', () => {
  test('register, shop, checkout COD, admin receives and updates, customer sees status', async ({ page, request, browser }) => {
    const customer = await registerUi(page, 'Ayesha Khan');

    // Empty cart
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();

    // Add from listing (card button) and from the product page
    await page.goto('/products?search=E2E%20Mineral');
    await page.getByRole('button', { name: 'Add E2E Mineral Water to cart' }).click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await addFromProductPage(page, 'E2E Basmati Rice', 2);
    await addFromProductPage(page, 'E2E Green Tea', 1);
    await expect(page.getByTestId('cart-count')).toHaveText('4');

    // Cart: update quantity, remove an item, subtotal
    await page.getByTestId('cart-link').click();
    await expect(page.getByTestId('cart-line')).toHaveCount(3);
    await page.getByRole('button', { name: 'Increase E2E Green Tea' }).click();
    await page.getByRole('button', { name: 'Remove E2E Mineral Water' }).click();
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await expect(page.getByText('Rs. 3,700').first()).toBeVisible(); // 2×1500 + 2×350

    // Checkout: no saved address yet → form; invalid address is refused
    await page.getByTestId('go-to-checkout').click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.getByLabel('Recipient name').fill('');
    await page.getByLabel('Phone number').fill('123');
    await page.getByRole('button', { name: 'Save and use this address' }).click();
    await expect(page.getByText("Enter the recipient's name.")).toBeVisible();
    await expect(page.getByText(/Enter a valid phone number/)).toBeVisible();
    await expect(page.getByText('Enter the house and street.')).toBeVisible();
    await expect(page.getByTestId('place-order')).toBeDisabled();
    await fillAddress(page);
    await page.getByRole('button', { name: 'Save and use this address' }).click();
    await expect(page.getByRole('radio', { name: /Ayesha Khan/ })).toBeChecked();

    // Server quote: subtotal + delivery fee
    await expect(page.getByTestId('order-total')).toHaveText('Rs. 3,850'); // 3,700 + 150 delivery
    await expect(page.getByText('Cash on Delivery').first()).toBeVisible();
    await page.getByLabel('Note for the store').fill('Please call on arrival');

    // Duplicate submissions: double click → exactly one order
    const placeOrder = page.getByTestId('place-order');
    await expect(placeOrder).toBeEnabled();
    await placeOrder.dblclick();
    await expect(page.getByTestId('order-confirmation')).toBeVisible();
    const reference = (await page.getByTestId('order-reference').textContent())!.trim();
    await expect(page.getByTestId('order-status').first()).toHaveText('Pending');
    await expect(page.getByTestId('cart-count')).toHaveCount(0); // cart emptied

    const access = await loginCustomerApi(request, customer.email, customer.password);
    const orders = await customerOrders(request, access);
    expect(orders.count).toBe(1);
    expect(orders.results[0].reference).toBe(reference);
    expect(orders.results[0].total).toBe('3850.00');

    // Stock was deducted by the backend
    const rice = await productByName(request, 'E2E Basmati Rice');
    expect(rice.inStock).toBe(true);

    // Order history
    await page.goto('/orders');
    await expect(page.getByTestId('order-row')).toHaveCount(1);
    await expect(page.getByTestId('order-row')).toContainText(reference);

    // Admin portal receives the website order and confirms it
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await adminLogin(admin);
    await admin.goto(`${ADMIN}/#/orders`);
    await admin.getByLabel('Search orders').fill(reference);
    await expect(admin.getByText(reference).first()).toBeVisible();
    await admin.getByRole('link', { name: `View order ${reference}` }).click();
    await expect(admin.getByText('Please call on arrival')).toBeVisible();
    await expect(admin.getByText('Ayesha Khan').first()).toBeVisible();
    await admin.getByRole('button', { name: 'Confirm Order' }).click();
    await expect(admin.getByRole('button', { name: 'Start Preparing' })).toBeVisible();
    await adminContext.close();

    // Customer sees the new status (Refresh button, as tracking also polls every 30 s)
    await page.getByTestId('order-row').click();
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByTestId('order-status').first()).toHaveText('Confirmed');
    await expect(page.getByRole('listitem').filter({ hasText: 'Confirmed' }).first()).toBeVisible();
    // Confirmed orders can no longer be cancelled by the customer
    await expect(page.getByTestId('cancel-order')).toHaveCount(0);

    // Saved address is offered on the next checkout
    await addFromProductPage(page, 'E2E Green Tea', 1);
    await page.goto('/checkout');
    await expect(page.getByRole('radio', { name: /Ayesha Khan/ })).toBeChecked();
    await expect(page.getByTestId('place-order')).toBeEnabled();

    // Place and cancel a pending order; stock comes back
    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('order-confirmation')).toBeVisible();
    await page.getByTestId('cancel-order').click();
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByText('This order was cancelled')).toBeVisible();
    const after = await customerOrders(request, access);
    expect(after.results[0].status).toBe('cancelled');
    expect(after.count).toBe(2);
    void API;
  });
});
