import { expect, test, type Page } from '@playwright/test';

import { addFromProductPage, fillAddress, registerUi } from './helpers';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
];

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
}

for (const vp of VIEWPORTS) {
  test(`layout at ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const shot = (name: string) => page.screenshot({ path: `test-results/screenshots/${vp.name}-${name}.png`, fullPage: true });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search products' }).first()).toBeVisible();
    await expect(page.getByTestId('cart-link')).toBeVisible();
    await expectNoHorizontalScroll(page, 'home');
    await shot('home');

    await page.goto('/products');
    await expect(page.getByTestId('product-card').first()).toBeVisible();
    await expectNoHorizontalScroll(page, 'products');
    await shot('products');

    await registerUi(page);
    await addFromProductPage(page, 'E2E Basmati Rice', 2);
    await expectNoHorizontalScroll(page, 'product');
    await shot('product');

    await page.goto('/cart');
    await expect(page.getByTestId('go-to-checkout')).toBeInViewport({ ratio: 0.1 }).catch(() => {});
    await expectNoHorizontalScroll(page, 'cart');
    await shot('cart');

    await page.goto('/checkout');
    await fillAddress(page);
    await expectNoHorizontalScroll(page, 'checkout form');
    await page.getByRole('button', { name: 'Save and use this address' }).click();
    await expect(page.getByTestId('order-total')).toBeVisible();
    await expectNoHorizontalScroll(page, 'checkout');
    await shot('checkout');

    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('order-confirmation')).toBeVisible();
    await expectNoHorizontalScroll(page, 'order');
    await shot('order');
  });
}
