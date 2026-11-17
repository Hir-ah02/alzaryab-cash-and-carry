import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { Check, Plus, TriangleAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatPriceInput } from '../utils/format';
import { useCategories } from '../utils/useCategories';
import { PRODUCT_FIELD_ORDER, validateProduct, validateProductField } from '../utils/validation';
import Alert from './Alert';
import Button from './Button';
import Checkbox from './Checkbox';
import ConfirmModal from './ConfirmModal';
import ImageUpload from './ImageUpload';
import NumberField from './NumberField';
import Select from './Select';
import TextArea from './TextArea';
import TextField from './TextField';

export const EMPTY_PRODUCT_VALUES = {
  name: '', category: '', unit: '', stock: '', price: '', description: '', isAvailable: true, image: null,
};

const FIELD_IDS = {
  name: 'product-name',
  description: 'product-description',
  category: 'product-category',
  unit: 'product-unit',
  stock: 'product-stock',
  price: 'product-price',
  image: 'product-image',
};

/** Product (from the service) → form values (all strings). */
export function productToFormValues(p) {
  return {
    name: p.name,
    category: p.category,
    unit: p.unit,
    stock: String(p.stock),
    price: formatPriceInput(p.price),
    description: p.description ?? '',
    isAvailable: p.isAvailable ?? true,
    image: p.image ? { src: p.image, name: 'Product image' } : null,
  };
}

/**
 * Form values → payload for createProduct / updateProduct.
 * image: the newly chosen File, null if the saved image was removed, or
 * undefined to keep the saved image (so editing details never re-uploads it).
 */
function formValuesToPayload(v, initial) {
  let image;
  if (v.image?.file) image = v.image.file;
  else if (!v.image && initial.image) image = null;
  return {
    name: v.name, category: v.category, unit: v.unit, stock: v.stock, price: v.price,
    description: v.description, isAvailable: v.isAvailable, image,
  };
}

function isSame(a, b) {
  return (
    ['name', 'category', 'unit', 'stock', 'price', 'description', 'isAvailable'].every((k) => String(a[k]) === String(b[k])) &&
    (a.image?.src ?? null) === (b.image?.src ?? null)
  );
}

function focusField(field) {
  const el = document.getElementById(FIELD_IDS[field]);
  if (el) {
    el.focus();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/**
 * Shared form for Add Product (mode="create") and Edit Product (mode="edit").
 * onSubmit(payload) performs the save and returns the saved product;
 * onSuccess(product) runs afterwards (navigate + toast).
 */
export default function ProductForm({ mode = 'create', initialValues = EMPTY_PRODUCT_VALUES, onSubmit, onSuccess, onCancel }) {
  const isEdit = mode === 'edit';
  const validationOptions = { requireImage: !isEdit };
  const { isAuthenticated } = useAuth();
  const categories = useCategories();
  // Keep the product's current category selectable even before the list loads.
  const categoryOptions =
    initialValues.category && !categories.includes(initialValues.category)
      ? [initialValues.category, ...categories]
      : categories;
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const initialRef = useRef(initialValues);
  const savedRef = useRef(false);

  const isDirty = !isSame(values, initialRef.current);

  // ----- Unsaved-changes protection -----
  // Not when the session has ended: the redirect to /login must go through.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && isAuthenticated && !savedRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // ----- Field handlers -----
  const setField = (field, value) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Re-validate as the user types only once a field is showing an error,
    // so the message clears as soon as the problem is fixed.
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateProductField(field, next, validationOptions) }));
    }
  };

  const handleBlur = (field) => {
    setErrors((prev) => ({ ...prev, [field]: validateProductField(field, values, validationOptions) }));
  };

  const inputProps = (field) => ({
    id: FIELD_IDS[field],
    value: values[field],
    error: errors[field],
    onChange: (e) => setField(field, e.target.value),
    onBlur: () => handleBlur(field),
  });

  const errorFields = PRODUCT_FIELD_ORDER.filter((f) => errors[f]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const found = validateProduct(values, validationOptions);
    setErrors(found);
    const invalid = PRODUCT_FIELD_ORDER.filter((f) => found[f]);
    if (invalid.length > 0) {
      setShowSummary(true);
      focusField(invalid[0]);
      return;
    }

    setShowSummary(false);
    setSubmitError('');
    setSubmitting(true);
    try {
      const saved = await onSubmit(formValuesToPayload(values, initialRef.current));
      savedRef.current = true;
      onSuccess(saved);
    } catch (err) {
      setSubmitting(false);
      // Server-side validation (e.g. duplicate product, rejected image): show it on the fields.
      const serverErrors = Object.fromEntries(
        Object.entries(err.fields ?? {}).filter(([field]) => PRODUCT_FIELD_ORDER.includes(field)),
      );
      const invalid = PRODUCT_FIELD_ORDER.filter((f) => serverErrors[f]);
      if (invalid.length > 0) {
        setErrors((prev) => ({ ...prev, ...serverErrors }));
        setShowSummary(true);
        focusField(invalid[0]);
        return;
      }
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <form className="product-form" noValidate onSubmit={handleSubmit}>
      {showSummary && errorFields.length > 0 && (
        <Alert
          variant="error"
          role="alert"
          title={`Please fix ${errorFields.length} ${errorFields.length === 1 ? 'error' : 'errors'} before saving.`}
        >
          <ul>
            {errorFields.map((field) => (
              <li key={field}>
                <button type="button" className="alert__link" onClick={() => focusField(field)}>
                  {errors[field]}
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {submitError && (
        <Alert variant="error" role="alert" title={isEdit ? "Couldn't save changes" : "Couldn't add product"}>
          {submitError}
        </Alert>
      )}

      <div className="form-grid">
        <section className="card" aria-labelledby="product-info-title">
          <div className="card__header">
            <div>
              <h2 id="product-info-title" className="card__title">
                Product Information
              </h2>
              <p className="card__subtitle">Basic details shown in your inventory.</p>
            </div>
          </div>
          <div className="card__body form-fields">
            <TextField
              {...inputProps('name')}
              label="Product Name"
              required
              placeholder="e.g. Olpers Full Cream Milk"
              maxLength={80}
              autoComplete="off"
            />
            <TextArea
              id={FIELD_IDS.description}
              label="Description"
              rows={3}
              maxLength={1000}
              placeholder="Optional details shown to customers, e.g. brand, pack contents"
              value={values.description}
              error={errors.description}
              onChange={(e) => setField('description', e.target.value)}
            />
            <div className="form-row">
              <Select
                {...inputProps('category')}
                label="Category"
                required
                placeholder="Select category"
                options={categoryOptions}
              />
              <TextField
                {...inputProps('unit')}
                label="Unit"
                required
                placeholder="e.g. 1 L, 500 g, 1 kg, 1 pack"
                helper="Pack size or weight sold per item."
                autoComplete="off"
              />
            </div>
            <div className="form-row">
              <NumberField
                {...inputProps('stock')}
                label="Stock Quantity"
                required
                placeholder="e.g. 25"
                helper="Whole units currently available."
              />
              <NumberField
                {...inputProps('price')}
                label="Price (PKR)"
                required
                currency
                allowDecimal
                placeholder="e.g. 320"
                helper="Selling price per unit."
              />
            </div>
            <Checkbox
              id="product-available"
              label="Available to customers"
              checked={values.isAvailable}
              onChange={(e) => setField('isAvailable', e.target.checked)}
            />
            <p className="field__helper form-fields__note">
              Untick to hide this product from the store without removing it, e.g. seasonal items.
            </p>
          </div>
        </section>

        <section className="card" aria-labelledby="product-image-title">
          <div className="card__header">
            <div>
              <h2 id="product-image-title" className="card__title">
                Product Image
                {!isEdit && (
                  <>
                    <span className="field__required" aria-hidden="true">
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </>
                )}
              </h2>
              <p className="card__subtitle">Shown next to the product in lists.</p>
            </div>
          </div>
          <div className="card__body">
            <ImageUpload
              id={FIELD_IDS.image}
              value={values.image}
              error={errors.image}
              onChange={(image) => setField('image', image)}
            />
          </div>
        </section>
      </div>

      <div className="card form-footer">
        <p className="form-footer__note">
          Fields marked <span aria-hidden="true">*</span>
          <span className="sr-only">with an asterisk</span> are required.
        </p>
        <div className="form-footer__actions">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            leadingIcon={isEdit ? Check : Plus}
            loading={submitting}
            loadingText={isEdit ? 'Saving…' : 'Adding…'}
          >
            {isEdit ? 'Save Changes' : 'Add Product'}
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={blocker.state === 'blocked'}
        tone="warning"
        icon={TriangleAlert}
        title="Discard unsaved changes?"
        message="You have changes that haven't been saved. If you leave this page, they will be lost."
        cancelLabel="Keep Editing"
        confirmLabel="Discard Changes"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  );
}
