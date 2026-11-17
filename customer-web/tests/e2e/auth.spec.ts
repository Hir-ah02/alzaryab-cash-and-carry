import { expect, test } from '@playwright/test';

import { loginUi, PASSWORD, registerApi, registerUi, STAFF_EMAIL, STAFF_PASSWORD } from './helpers';

test.describe('Customer authentication', () => {
  test('customer pages require sign-in and return afterwards', async ({ page, request }) => {
    for (const path of ['/orders', '/checkout', '/account', '/account/addresses', '/orders/1']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, '%2F')}$`));
    }
    const customer = await registerApi(request, 'return');
    await loginUi(page, customer.email, customer.password, '/login?next=%2Forders');
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
  });

  test('invalid login is rejected with a clear message', async ({ page, request }) => {
    const customer = await registerApi(request, 'invalid');
    await loginUi(page, customer.email, 'wrong-password-123');
    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
    await loginUi(page, 'nobody@example.test', 'whatever-123');
    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
    await loginUi(page, 'not-an-email', 'x');
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  });

  test('staff accounts cannot sign in to the shop', async ({ page }) => {
    await loginUi(page, STAFF_EMAIL, STAFF_PASSWORD);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('account-menu')).toHaveCount(0);
  });

  test('registration validates and rejects duplicate emails', async ({ page, request }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your name.')).toBeVisible();
    await page.getByLabel('Full name').fill('Test User');
    await page.getByLabel('Email').fill('dupe@example.test');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password', { exact: true }).fill('Different-123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText("Passwords don't match.")).toBeVisible();

    const existing = await registerApi(request, 'dupe');
    await page.getByLabel('Email').fill(existing.email);
    await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('An account with this email already exists.')).toBeVisible();
  });

  test('register, sign out and sign back in with the same credentials (shared with the mobile app API)', async ({ page }) => {
    const customer = await registerUi(page, 'Bilal Ahmed');
    await expect(page.getByTestId('account-menu')).toContainText('Bilal');
    await page.getByTestId('account-menu').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    // Signed out: protected pages are closed again.
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
    await loginUi(page, customer.email, customer.password);
    await expect(page.getByTestId('account-menu')).toBeVisible();
    // Session survives a reload (refresh token in storage, access token re-issued).
    await page.reload();
    await expect(page.getByTestId('account-menu')).toBeVisible();
    await page.goto('/account');
    await expect(page.getByLabel('Email')).toHaveValue(customer.email);
  });

  test('open redirects are refused after sign-in', async ({ page, request }) => {
    const customer = await registerApi(request, 'redirect');
    await loginUi(page, customer.email, customer.password, '/login?next=https%3A%2F%2Fevil.example');
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });
});
