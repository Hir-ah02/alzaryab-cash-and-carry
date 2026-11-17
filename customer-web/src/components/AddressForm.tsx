import { useState, type FormEvent } from 'react';

import { ApiError } from '@/api/errors';
import type { Address, AddressInput } from '@/api/types';
import { cleanAddress, validateAddress, type AddressValues, type FieldErrors } from '@/utils/validation';

import { Button, Notice, TextArea, TextField } from './ui';

const EMPTY: AddressValues = { label: '', recipientName: '', phone: '', line1: '', line2: '', area: '', city: '', postalCode: '', instructions: '' };

interface Props {
  initial?: Partial<Address>;
  submitLabel: string;
  /** Saves via the API; a rejected ApiError's field messages are shown on the matching fields. */
  onSubmit: (values: AddressInput) => Promise<unknown>;
  onCancel?: () => void;
  showDefaultOption?: boolean;
}

export function AddressForm({ initial, submitLabel, onSubmit, onCancel, showDefaultOption }: Props) {
  const [values, setValues] = useState<AddressValues>(() => {
    const v = { ...EMPTY };
    for (const key of Object.keys(EMPTY) as (keyof AddressValues)[]) v[key] = (initial?.[key] as string | undefined) ?? '';
    return v;
  });
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);
  const [errors, setErrors] = useState<FieldErrors<keyof AddressValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const field = (key: keyof AddressValues) => ({
    value: values[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      if (errors[key]) setErrors((all) => ({ ...all, [key]: undefined }));
    },
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found = validateAddress(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSubmit({ ...cleanAddress(values), ...(showDefaultOption ? { isDefault } : {}) });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setErrors(err.fields as FieldErrors<keyof AddressValues>);
        setFormError(err.fields.detail ?? null);
      } else {
        setFormError(err instanceof Error ? err.message : 'Could not save the address.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Delivery address">
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Recipient name" autoComplete="name" required {...field('recipientName')} />
        <TextField label="Phone number" type="tel" autoComplete="tel" inputMode="tel" placeholder="03001234567" required {...field('phone')} />
      </div>
      <TextField label="House / flat and street" autoComplete="address-line1" required {...field('line1')} />
      <TextField label="Building, landmark" autoComplete="address-line2" optional {...field('line2')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Area / sector" autoComplete="address-level3" required {...field('area')} />
        <TextField label="City" autoComplete="address-level2" required {...field('city')} />
        <TextField label="Postal code" autoComplete="postal-code" inputMode="numeric" optional {...field('postalCode')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Label" placeholder="Home, Office…" optional {...field('label')} />
      </div>
      <TextArea label="Delivery instructions" placeholder="E.g. ring the bell twice" optional rows={2} {...field('instructions')} />
      {showDefaultOption && (
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-4 accent-brand-600" />
          Use as my default delivery address
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving}>{submitLabel}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>}
      </div>
    </form>
  );
}

export function formatAddressLines(a: Pick<Address, 'line1' | 'line2' | 'area' | 'city' | 'postalCode'>) {
  return [a.line1, a.line2, [a.area, a.city].filter(Boolean).join(', '), a.postalCode].filter(Boolean);
}

export function AddressText({ address }: { address: Pick<Address, 'recipientName' | 'phone' | 'line1' | 'line2' | 'area' | 'city' | 'postalCode' | 'instructions'> }) {
  return (
    <div className="text-sm leading-relaxed">
      <p className="font-semibold">{address.recipientName}</p>
      {formatAddressLines(address).map((line) => <p key={line} className="text-ink-2">{line}</p>)}
      <p className="text-ink-2">{address.phone}</p>
      {address.instructions && <p className="mt-1 text-xs italic text-ink-3">“{address.instructions}”</p>}
    </div>
  );
}
