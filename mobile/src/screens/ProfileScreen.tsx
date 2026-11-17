/** Edit name and phone (PATCH /customer/profile/). The email is the sign-in name and can't be changed here. */
import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { ApiError, MESSAGES } from '@/api/errors';
import { updateProfile } from '@/api/customer';
import type { Customer } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { fullNameError, normalizePhone, phoneError, splitFullName } from '@/utils/validation';

type Field = 'fullName' | 'phone';

export default function ProfileScreen() {
  const { customer } = useAuth();
  // After a restart the profile may still be loading; the form starts from the real values.
  if (!customer) return <LoadingState label="Loading your profile…" />;
  return <ProfileForm key={customer.id} customer={customer} />;
}

function ProfileForm({ customer }: { customer: Customer }) {
  const { applyProfile } = useAuth();
  const [fullName, setFullName] = useState([customer.firstName, customer.lastName].filter(Boolean).join(' '));
  const [phone, setPhone] = useState(customer.phone);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const save = async () => {
    if (busy.current) return;
    const found = { fullName: fullNameError(fullName), phone: phoneError(phone, { required: false }) };
    setErrors(found);
    setFormError(null);
    if (found.fullName || found.phone) return;

    busy.current = true;
    setSaving(true);
    try {
      const { firstName, lastName } = splitFullName(fullName);
      await applyProfile(await updateProfile({ firstName, lastName, phone: normalizePhone(phone) }));
      router.back();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setErrors({ fullName: err.fields.firstName ?? err.fields.lastName, phone: err.fields.phone });
        setFormError(MESSAGES.invalid);
      } else {
        setFormError(err instanceof ApiError ? err.message : MESSAGES.server);
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <FormScreen footer={<Button title="Save changes" icon="checkmark" onPress={() => void save()} loading={saving} fullWidth />}>
      {formError && <Notice tone="error">{formError}</Notice>}
      <TextField label="Full name" value={fullName} onChangeText={setFullName} error={errors.fullName} autoComplete="name" autoCapitalize="words" />
      <TextField
        label="Phone number (optional)"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        helper="e.g. 0300 1234567"
      />
      <TextField label="Email address" value={customer.email} editable={false} helper="Your email is how you sign in, so it can't be changed here." />
    </FormScreen>
  );
}
