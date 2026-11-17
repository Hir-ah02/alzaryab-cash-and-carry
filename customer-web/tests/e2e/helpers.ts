import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = process.env.E2E_API ?? 'http://localhost:8001/api';
export const ADMIN = process.env.E2E_ADMIN ?? 'http://localhost:5175';
export const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL ?? '';
export const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD ?? '';
export const PASSWORD = 'Grocery-Test-2026!';

let counter = 0;
export function uniqueEmail(tag = 'customer') {
  counter += 1;
  return `${tag}-${Date.now()}-${counter}@example.test`;
}

export interface TestCustomer {
  email: string;
  password: string;
  access: string;
  name: string;
}

/** Registers through the API (same endpoint the website and mobile app use). */
export async function registerApi(request: APIRequestContext, tag = 'api'): Promise<TestCustomer> {
  const email = uniqueEmail(tag);
  const res = await request.post(`${API}/customer/auth/register/`, { data: { email, password: PASSWORD, firstName: 'Api', lastName: 'Shopper' } });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  return { email, password: PASSWORD, access: body.access, name: 'Api Shopper' };
}

export async function staffToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login/`, { data: { email: STAFF_EMAIL, password: STAFF_PASSWORD } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).access;
}

export async function productByName(request: APIRequestContext, name: string) {
  const res = await request.get(`${API}/catalog/products/?search=${encodeURIComponent(name)}`);
  const body = await res.json();
  const product = body.results.find((p: { name: string }) => p.name === name);
  expect(product, `product ${name}`).toBeTruthy();
  return product as { id: number; name: string; price: string; inStock: boolean; stockStatus: string };
}

/** Staff API (admin portal endpoint): change a product's price / stock. */
export async function patchProduct(request: APIRequestContext, token: string, id: number, data: Record<string, unknown>) {
  const res = await request.patch(`${API}/products/${id}/`, { data, headers: { Authorization: `Bearer ${token}` } });
  expect(res.status(), await res.text()).toBe(200);
  return res.json();
}

export async function customerOrders(request: APIRequestContext, access: string) {
  const res = await request.get(`${API}/customer/orders/`, { headers: { Authorization: `Bearer ${access}` } });
  expect(res.status()).toBe(200);
  return (await res.json()) as { count: number; results: { id: number; reference: string; status: string; total: string }[] };
}

export async function loginCustomerApi(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API}/customer/auth/login/`, { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).access as string;
}

export async function registerUi(page: Page, name = 'Ayesha Khan'): Promise<TestCustomer> {
  const email = uniqueEmail('web');
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByTestId('account-menu')).toBeVisible();
  return { email, password: PASSWORD, access: '', name };
}

export async function loginUi(page: Page, email: string, password: string, path = '/login') {
  await page.goto(path);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

export async function addFromProductPage(page: Page, name: string, quantity = 1) {
  await page.goto(`/products?search=${encodeURIComponent(name)}`);
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  if (quantity !== 1) await page.getByLabel(`${name} quantity`).fill(String(quantity));
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByTestId('in-cart')).toBeVisible();
}

export async function fillAddress(page: Page) {
  await page.getByLabel('Recipient name').fill('Ayesha Khan');
  await page.getByLabel('Phone number').fill('0300-1234567');
  await page.getByLabel('House / flat and street').fill('House 12, Street 4');
  await page.getByLabel('Area / sector').fill('G-11/2');
  await page.getByLabel('City').fill('Islamabad');
}

export async function adminLogin(page: Page) {
  await page.goto(`${ADMIN}/#/login`);
  await page.getByLabel('Email Address').fill(STAFF_EMAIL);
  await page.getByPlaceholder('Enter your password').fill(STAFF_PASSWORD); // the admin label reads "Password*"
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).not.toHaveURL(/#\/login/);
}

export async function cartCount(page: Page) {
  const badge = page.getByTestId('cart-count');
  return (await badge.count()) ? Number(await badge.textContent()) : 0;
}
