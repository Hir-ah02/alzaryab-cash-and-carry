import { getProduct, listCategories, listProducts } from '@/api/catalog';
import { setApiBaseUrl } from '@/api/client';
import { toOrderDetail } from '@/api/orders';
import type { ApiOrderDetail } from '@/api/types';
import { formatPrice } from '@/utils/format';

import { API_CATEGORY, API_PRODUCT, jsonResponse, mockFetch, page } from './helpers';

beforeEach(() => setApiBaseUrl('http://test.local/api'));

describe('catalogue', () => {
  it('lists products with search, category and paging, converting prices to numbers', async () => {
    const calls = mockFetch(() => jsonResponse(200, page([API_PRODUCT], 31)));
    const result = await listProducts({ search: ' milk ', category: 'Dairy & Eggs', page: 2, pageSize: 20 });

    const url = new URL(calls[0].url);
    expect(url.pathname).toBe('/api/catalog/products/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ search: 'milk', category: 'Dairy & Eggs', page: '2', page_size: '20' });
    expect(calls[0].headers.Authorization).toBeUndefined(); // public endpoint
    expect(result.count).toBe(31);
    expect(result.results[0]).toEqual({ ...API_PRODUCT, price: 1250.5 });
  });

  it('gets one product and the categories', async () => {
    mockFetch((call) => jsonResponse(200, call.url.includes('/categories/') ? [API_CATEGORY] : API_PRODUCT));
    expect((await getProduct(12)).price).toBe(1250.5);
    expect(await listCategories()).toEqual([API_CATEGORY]);
  });

  it('formats prices like the admin portal', () => {
    expect(formatPrice(1800)).toBe('Rs. 1,800');
    expect(formatPrice(1250.5)).toBe('Rs. 1,250.50');
    expect(formatPrice(1234567.891)).toBe('Rs. 1,234,567.89');
    expect(formatPrice(Number.NaN)).toBe('Rs. 0');
  });
});

describe('orders', () => {
  it('converts every money field of an order', () => {
    const api: ApiOrderDetail = {
      id: 5, reference: 'AZ-7K3QF9MD', status: 'pending', statusLabel: 'Pending', itemCount: 1,
      subtotal: '640.00', deliveryFee: '150.00', total: '790.00', paymentMethod: 'cash_on_delivery', paymentStatus: 'unpaid',
      createdAt: '', updatedAt: '', customerNote: '', cancelReason: '', canCancel: true, history: [],
      delivery: { name: 'Ali', phone: '0300', line1: '1', line2: '', area: 'Gulberg', city: 'Lahore', postalCode: '', instructions: '' },
      items: [{ id: 1, productId: 3, productName: 'Milk', unit: '1 L', unitPrice: '320.00', quantity: 2, lineTotal: '640.00' }],
    };
    const order = toOrderDetail(api);
    expect([order.subtotal, order.deliveryFee, order.total]).toEqual([640, 150, 790]);
    expect(order.items[0]).toMatchObject({ unitPrice: 320, lineTotal: 640 });
  });
});
