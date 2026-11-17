import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { installStorage, jsonResponse, mockFetch, signIn } from './testSupport.js';
import { createProduct, getProduct, listProducts, removeProduct, summarize, updateProduct } from './productService.js';
import { listCategories } from './categoryService.js';

// Shape returned by the Django API (see backend/apps/catalog/serializers.py).
const API_PRODUCT = {
  id: 12,
  name: 'Olpers Milk',
  category: 'Dairy & Eggs',
  categoryId: 2,
  description: '',
  unit: '1 L',
  price: '1800.50',
  stock: 4,
  stockStatus: 'low',
  image: 'http://localhost:8000/media/products/abc.png',
  isAvailable: true,
  active: true,
  createdAt: '2026-11-03T10:00:00+05:00',
  updatedAt: '2026-11-03T10:00:00+05:00',
};

const FORM = { name: ' Olpers Milk ', category: 'Dairy & Eggs', unit: ' 1 L ', stock: ' 4 ', price: '1,800.50' };

beforeEach(() => {
  installStorage();
  signIn();
});

describe('listProducts', () => {
  test('sends search, filters and paging to the server and maps {count, results}', async () => {
    const calls = mockFetch(() => jsonResponse(200, { count: 31, next: null, previous: null, results: [API_PRODUCT] }));
    const result = await listProducts({ search: ' milk ', category: 'Dairy & Eggs', stock: 'low', page: 3, pageSize: 10 });

    const url = new URL(calls[0].url, 'http://x');
    assert.equal(url.pathname, '/api/products/');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      search: 'milk', category: 'Dairy & Eggs', stock: 'low', page: '3', page_size: '10',
    });
    assert.equal(result.total, 31);
    assert.equal(result.items[0].price, 1800.5);
    assert.equal(result.items[0].id, 12);
  });

  test('leaves out empty filters and page 1', async () => {
    const calls = mockFetch(() => jsonResponse(200, { count: 0, results: [] }));
    await listProducts();
    assert.equal(calls[0].url, '/api/products/?page_size=10');
  });

  test('asks for active, removed or all products when told to', async () => {
    for (const active of ['true', 'false', 'all']) {
      const calls = mockFetch(() => jsonResponse(200, { count: 0, results: [] }));
      await listProducts({ active });
      assert.equal(new URL(calls[0].url, 'http://x').searchParams.get('active'), active);
    }
  });

  test('leaves the active filter to the server default (active only) unless valid', async () => {
    for (const active of ['', 'maybe', undefined]) {
      const calls = mockFetch(() => jsonResponse(200, { count: 0, results: [] }));
      await listProducts({ active });
      assert.equal(new URL(calls[0].url, 'http://x').searchParams.has('active'), false);
    }
  });

  test('keeps the active flag so removed products can be labelled', async () => {
    mockFetch(() => jsonResponse(200, { count: 2, results: [API_PRODUCT, { ...API_PRODUCT, id: 3, active: false, isAvailable: false }] }));
    const { items } = await listProducts({ active: 'all' });
    assert.deepEqual(items.map((p) => [p.id, p.active]), [[12, API_PRODUCT.active], [3, false]]);
  });

  test('a page past the end rejects with status 404', async () => {
    mockFetch(() => jsonResponse(404, { detail: 'Invalid page.' }));
    const err = await listProducts({ page: 9 }).catch((e) => e);
    assert.equal(err.status, 404);
  });
});

describe('single products', () => {
  test('getProduct converts the price and reports missing products as 404', async () => {
    mockFetch(() => jsonResponse(200, API_PRODUCT));
    assert.equal((await getProduct('12')).price, 1800.5);
    mockFetch(() => jsonResponse(404, { detail: 'No Product matches the given query.' }));
    assert.equal((await getProduct('999').catch((e) => e)).status, 404);
  });

  test('createProduct without an image sends clean JSON (no thousands separators)', async () => {
    const calls = mockFetch(() => jsonResponse(201, API_PRODUCT));
    await createProduct({ ...FORM, image: undefined });
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].url, '/api/products/');
    assert.deepEqual(calls[0].body, { name: 'Olpers Milk', category: 'Dairy & Eggs', unit: '1 L', stock: '4', price: '1800.50' });
  });

  test('createProduct with an image uploads multipart form data', async () => {
    const calls = mockFetch(() => jsonResponse(201, API_PRODUCT));
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'milk.png', { type: 'image/png' });
    await createProduct({ ...FORM, image: file });

    const form = calls[0].rawBody;
    assert.ok(form instanceof FormData);
    assert.equal(form.get('price'), '1800.50');
    assert.equal(form.get('name'), 'Olpers Milk');
    assert.equal(form.get('image').name, 'milk.png');
    assert.equal(form.get('image').type, 'image/png');
  });

  test('updateProduct keeps, removes or replaces the image as asked', async () => {
    const calls = mockFetch(() => jsonResponse(200, API_PRODUCT));

    await updateProduct(12, { ...FORM, image: undefined });
    assert.equal(calls[0].method, 'PATCH');
    assert.equal(calls[0].url, '/api/products/12/');
    assert.equal('image' in calls[0].body, false, 'details-only edit does not touch the image');

    await updateProduct(12, { ...FORM, image: null });
    assert.equal(calls[1].body.image, null);

    await updateProduct(12, { ...FORM, image: new File(['x'], 'new.webp', { type: 'image/webp' }) });
    assert.ok(calls[2].rawBody instanceof FormData);
    assert.equal(calls[2].rawBody.get('image').name, 'new.webp');
  });

  test('server validation errors come back per field', async () => {
    mockFetch(() => jsonResponse(400, { image: ['Unsupported file type. Please upload a JPG, PNG or WEBP image.'] }));
    const err = await createProduct({ ...FORM }).catch((e) => e);
    assert.equal(err.fields.image, 'Unsupported file type. Please upload a JPG, PNG or WEBP image.');
  });

  test('removeProduct sends DELETE and resolves with the id', async () => {
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    assert.deepEqual(await removeProduct(12), { id: 12 });
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(calls[0].url, '/api/products/12/');
  });
});

describe('dashboard and categories', () => {
  test('summarize returns the server counts unchanged', async () => {
    const counts = { total: 5, inStock: 2, lowStock: 2, outOfStock: 1 };
    const calls = mockFetch(() => jsonResponse(200, counts));
    assert.deepEqual(await summarize(), counts);
    assert.equal(calls[0].url, '/api/products/summary/');
  });

  test('listCategories reads the category API', async () => {
    const calls = mockFetch(() => jsonResponse(200, [{ id: 1, name: 'Baby Care', active: true }]));
    assert.equal((await listCategories())[0].name, 'Baby Care');
    assert.equal(calls[0].url, '/api/categories/');
  });
});
