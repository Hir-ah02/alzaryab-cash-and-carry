/** Order used for the error summary and for focusing the first invalid field. */
export const PRODUCT_FIELD_ORDER = ['name', 'description', 'category', 'unit', 'stock', 'price', 'image'];

export const PRODUCT_FIELD_LABELS = {
  name: 'Product Name',
  description: 'Description',
  category: 'Category',
  unit: 'Unit',
  stock: 'Stock Quantity',
  price: 'Price (PKR)',
  image: 'Product Image',
};

const validators = {
  name: (v) => (!v.name.trim() ? 'Product name is required.' : v.name.trim().length > 80 ? 'Product name must be 80 characters or fewer.' : ''),
  description: (v) => ((v.description ?? '').length > 1000 ? 'Description must be 1000 characters or fewer.' : ''),
  // The list comes from the server, which also checks the category is active.
  category: (v) => (!v.category ? 'Please select a category.' : ''),
  unit: (v) => (!v.unit.trim() ? 'Unit is required.' : ''),
  stock: (v) => {
    const raw = String(v.stock).trim();
    if (raw === '') return 'Stock quantity is required.';
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return 'Stock must be a whole number.';
    if (Number(raw) < 0) return 'Stock cannot be negative.';
    if (!Number.isInteger(Number(raw))) return 'Stock must be a whole number.';
    return '';
  },
  price: (v) => {
    const raw = String(v.price).trim().replace(/,/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) return 'Enter a valid price.';
    return '';
  },
  // Required when adding. When editing it's optional, so products saved
  // without a photo (e.g. imported or added in Django admin) can still be updated.
  image: (v, { requireImage = true } = {}) => (requireImage && !v.image ? 'Please upload a product image.' : ''),
};

export function validateProductField(field, values, options) {
  return validators[field] ? validators[field](values, options) : '';
}

/** Returns an object of { field: message } for every invalid field. */
export function validateProduct(values, options) {
  const errors = {};
  PRODUCT_FIELD_ORDER.forEach((field) => {
    const message = validateProductField(field, values, options);
    if (message) errors[field] = message;
  });
  return errors;
}
