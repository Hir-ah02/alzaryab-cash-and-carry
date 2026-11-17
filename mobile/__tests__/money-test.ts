import { lineTotal, samePrice, sumLines, toMoney, toPaisa } from '@/api/money';
import { cartSubtotal } from '@/cart/cartReducer';
import { formatPrice } from '@/utils/format';

describe('money', () => {
  it('reads decimal strings from the API', () => {
    expect(toMoney('1250.50')).toBe(1250.5);
    expect(toMoney('abc')).toBe(0);
    expect(toPaisa(1250.5)).toBe(125050);
    expect(toPaisa(0.29)).toBe(29); // 0.29 * 100 is 28.999999999999996 in floating point
  });

  it('adds and multiplies without floating-point noise', () => {
    // Plain floating point gives 0.30000000000000004 and 3.3000000000000003 here.
    expect(sumLines([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }])).toBe(0.3);
    expect(lineTotal(1.1, 3)).toBe(3.3);
    expect(lineTotal(19.99, 3)).toBe(59.97);
    expect(sumLines([{ price: 33.33, quantity: 3 }, { price: 0.01, quantity: 1 }])).toBe(100);
    expect(formatPrice(sumLines([{ price: 0.1, quantity: 1 }, { price: 0.2, quantity: 1 }]))).toBe('Rs. 0.30');
  });

  it('cart subtotal uses whole paisa', () => {
    const items = [
      { productId: 1, name: 'A', unit: '', image: null, price: 0.1, quantity: 3 },
      { productId: 2, name: 'B', unit: '', image: null, price: 1250.55, quantity: 7 },
    ];
    expect(cartSubtotal({ items })).toBe(8754.15); // 0.30 + 8,753.85
  });

  it('compares prices to the paisa', () => {
    expect(samePrice(320, 320.0)).toBe(true);
    expect(samePrice(0.1 + 0.2, 0.3)).toBe(true);
    expect(samePrice(320, 320.01)).toBe(false);
  });
});
