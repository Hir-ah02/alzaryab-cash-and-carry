import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPrice, formatPriceInput } from './format.js';

test('formatPrice shows whole rupees plainly and paisa with two decimals', () => {
  assert.equal(formatPrice(1800), 'Rs. 1,800');
  assert.equal(formatPrice('1250.50'), 'Rs. 1,250.50');
  assert.equal(formatPrice(1250.5), 'Rs. 1,250.50');
  assert.equal(formatPrice('320.00'), 'Rs. 320');
});

test('formatPriceInput keeps two decimals for the edit form', () => {
  assert.equal(formatPriceInput(1300), '1300');
  assert.equal(formatPriceInput(1250.5), '1250.50');
  assert.equal(formatPriceInput(299.99), '299.99');
});
