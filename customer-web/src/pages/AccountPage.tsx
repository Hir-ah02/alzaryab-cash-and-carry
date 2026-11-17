import { LogOut, MapPin, Package } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { updateProfile } from '@/api/customer';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { useToast } from '@/components/Toast';
import { Button, Card, Notice, PageHeading, TextField } from '@/components/ui';
import { formatDate } from '@/utils/format';
import { normalizePhone, phoneError } from '@/utils/validation';

export default function AccountPage() {
  const { customer, applyProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [firstName, setFirstName] = useState(customer?.firstName ?? '');
  const [lastName, setLastName] = useState(customer?.lastName ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = {
      firstName: firstName.trim() ? (firstName.trim().length > 150 ? 'Name is too long.' : undefined) : 'Enter your first name.',
      lastName: lastName.trim().length > 150 ? 'Name is too long.' : undefined,
      phone: phoneError(phone, { required: false }),
    };
    setErrors(found);
    setFormError(null);
    if (Object.values(found).some(Boolean)) return;
    setSaving(true);
    try {
      const updated = await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() ? normalizePhone(phone) : '' });
      applyProfile(updated);
      toast('Profile saved');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setFormError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeading title="My account" subtitle={customer?.dateJoined ? `Customer since ${formatDate(customer.dateJoined)}` : undefined} />
      <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-start">
        <Card className="p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-bold">Profile</h2>
          <form onSubmit={submit} noValidate className="space-y-4">
            {formError && <Notice tone="error">{formError}</Notice>}
            <TextField label="Email" value={customer?.email ?? ''} disabled hint="Your email is your sign-in name and can't be changed." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="First name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={errors.firstName} />
              <TextField label="Last name" autoComplete="family-name" optional value={lastName} onChange={(e) => setLastName(e.target.value)} error={errors.lastName} />
            </div>
            <TextField label="Phone number" type="tel" autoComplete="tel" optional value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} placeholder="03001234567" />
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        </Card>
        <nav className="space-y-2" aria-label="Account">
          {[
            { to: '/orders', icon: Package, label: 'My orders' },
            { to: '/account/addresses', icon: MapPin, label: 'Saved addresses' },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 font-semibold hover:border-brand-600">
              <Icon className="size-5 text-brand-600" aria-hidden />{label}
            </Link>
          ))}
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-white p-4 font-semibold text-danger hover:border-danger"
          >
            <LogOut className="size-5" aria-hidden />Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}
