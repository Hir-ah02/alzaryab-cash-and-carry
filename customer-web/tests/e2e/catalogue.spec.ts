import { expect, test } from '@playwright/test';

import { addFromProductPage, API, productByName, staffToken } from './helpers';

test.describe('Catalogue (live backend data)', () => {
  test('homepage shows branding, categories and only products on sale', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Al Zaryab Cash & Carry, home' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Beverages/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Basmati Rice', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    // Hidden (unavailable) and soft-deleted products never appear.
    await page.goto('/products');
    await expect(page.getByTestId('product-card').first()).toBeVisible();
    await expect(page.getByText('E2E Hidden Biscuits')).toHaveCount(0);
    await expect(page.getByText('E2E Deleted Juice')).toHaveCount(0);
  });

  test('search and category filter', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search products' }).first().fill('basmati');
    await page.getByRole('searchbox', { name: 'Search products' }).first().press('Enter');
    await expect(page).toHaveURL(/\/products\?search=basmati/);
    await expect(page.getByTestId('result-count')).toHaveText('1 product');
    await expect(page.getByRole('link', { name: 'E2E Basmati Rice', exact: true })).toBeVisible();

    await page.goto('/products?search=zzz-no-such-thing');
    await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();

    await page.goto('/products');
    await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'Beverages' }).click();
    await expect(page).toHaveURL(/category=Beverages/);
    await expect(page.getByRole('heading', { level: 1, name: 'Beverages' })).toBeVisible();
    const names = await page.getByTestId('product-card').locator('h3').allTextContents();
    expect(names.sort()).toEqual(['E2E Green Tea', 'E2E Mineral Water']);
  });

  test('product details, quantity and add to cart', async ({ page }) => {
    await addFromProductPage(page, 'E2E Basmati Rice', 3);
    await expect(page.getByTestId('product-price')).toHaveText('Rs. 1,500');
    await expect(page.getByText('5 kg').first()).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveText('3');
  });

  test('out-of-stock product cannot be added', async ({ page, request }) => {
    const sugar = await productByName(request, 'E2E Sugar');
    expect(sugar.inStock).toBe(false);
    await page.goto('/products?search=E2E%20Sugar');
    const card = page.getByTestId('product-card').filter({ hasText: 'E2E Sugar' });
    await expect(card.getByText('Out of stock').first()).toBeVisible();
    await expect(card.getByRole('button', { name: /Add/ })).toHaveCount(0);
    await page.goto(`/products/${sugar.id}`);
    await expect(page.getByText("This product can't be ordered right now.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0);
  });

  test('hidden product page says not available', async ({ page, request }) => {
    // The hidden product's id comes from the staff API (it is not public).
    const token = await staffToken(request);
    const res = await request.get(`${API}/products/?search=${encodeURIComponent('E2E Hidden Biscuits')}`, { headers: { Authorization: `Bearer ${token}` } });
    const hidden = (await res.json()).results[0];
    expect(hidden.isAvailable).toBe(false);
    await page.goto(`/products/${hidden.id}`);
    await expect(page.getByRole('heading', { name: 'Product not available' })).toBeVisible();
    await page.goto('/products/not-a-number');
    await expect(page.getByRole('heading', { name: 'Product not available' })).toBeVisible();
  });

  test('API/network failure shows an error with retry', async ({ page }) => {
    let fail = true;
    await page.route('**/api/catalog/products/**', (route) => (fail ? route.abort('failed') : route.continue()));
    await page.goto('/products');
    await expect(page.getByText("Couldn't load products")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Can't reach Al Zaryab")).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });
});
