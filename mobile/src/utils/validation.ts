/**
 * Form checks that mirror the Django serializers, so most mistakes are caught
 * before a request. The server still validates everything (and has the final
 * say on passwords: it also rejects common passwords and ones too similar to
 * the name or email).
 */
import type { AddressInput } from '@/api/types';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Same rule as PHONE_PATTERN in backend/apps/accounts/models.py, applied after normalising. */
const PHONE_PATTERN = /^\+?\d{10,15}$/;
export const PASSWORD_MIN_LENGTH = 8;

/** '0300-123 4567' → '03001234567' (keeps a leading +), like the server's normalize_phone. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
}

export function phoneError(value: string, { required }: { required: boolean }): string | undefined {
  if (!value.trim()) return required ? 'Enter a phone number.' : undefined;
  return PHONE_PATTERN.test(normalizePhone(value)) ? undefined : 'Enter a valid phone number, e.g. 03001234567 or +923001234567.';
}

export function emailError(value: string): string | undefined {
  if (!value.trim()) return 'Enter your email address.';
  if (value.trim().length > 150) return 'Email address is too long.';
  return EMAIL_PATTERN.test(value.trim()) ? undefined : 'Enter a valid email address.';
}

/** "  Ali   Raza Khan " → { firstName: 'Ali', lastName: 'Raza Khan' } */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export function fullNameError(value: string): string | undefined {
  const { firstName, lastName } = splitFullName(value);
  if (!firstName) return 'Enter your name.';
  if (firstName.length > 150 || lastName.length > 150) return 'Name is too long.';
  return undefined;
}

export function passwordError(value: string): string | undefined {
  if (!value) return 'Enter a password.';
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (value.length > 128) return 'Use at most 128 characters.';
  if (/^\d+$/.test(value)) return "A password can't be only numbers.";
  return undefined;
}

export interface RegistrationValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export function validateRegistration(v: RegistrationValues): FieldErrors<keyof RegistrationValues> {
  const errors: FieldErrors<keyof RegistrationValues> = {
    fullName: fullNameError(v.fullName),
    email: emailError(v.email),
    phone: phoneError(v.phone, { required: false }),
    password: passwordError(v.password),
    confirmPassword: !v.confirmPassword ? 'Enter the password again.' : v.confirmPassword !== v.password ? "Passwords don't match." : undefined,
  };
  return withoutEmpty(errors);
}

export function validateLogin(email: string, password: string): FieldErrors<'email' | 'password'> {
  return withoutEmpty({ email: emailError(email), password: password ? undefined : 'Enter your password.' });
}

export type AddressValues = Omit<AddressInput, 'isDefault'>;

const ADDRESS_LIMITS: Record<keyof AddressValues, number> = {
  label: 30,
  recipientName: 100,
  phone: 20,
  line1: 200,
  line2: 200,
  area: 100,
  city: 60,
  postalCode: 10,
  instructions: 255,
};

export function validateAddress(v: AddressValues): FieldErrors<keyof AddressValues> {
  const errors: FieldErrors<keyof AddressValues> = {};
  for (const [key, max] of Object.entries(ADDRESS_LIMITS) as [keyof AddressValues, number][]) {
    if (v[key].trim().length > max) errors[key] = `Use at most ${max} characters.`;
  }
  if (!v.recipientName.trim()) errors.recipientName = "Enter the recipient's name.";
  if (!v.line1.trim()) errors.line1 = 'Enter the house and street.';
  if (!v.area.trim()) errors.area = 'Enter the area.';
  if (!v.city.trim()) errors.city = 'Enter the city.';
  errors.phone = errors.phone ?? phoneError(v.phone, { required: true });
  return withoutEmpty(errors);
}

/** Address form values as the API expects them: trimmed, phone normalised. */
export function cleanAddress(v: AddressValues): AddressValues {
  const out = Object.fromEntries(Object.entries(v).map(([k, value]) => [k, value.trim()])) as AddressValues;
  return { ...out, phone: normalizePhone(out.phone) };
}

function withoutEmpty<T extends Record<string, string | undefined>>(errors: T): T {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as T;
}

export function resetCodeError(value: string): string | undefined {
  if (!value.trim()) return 'Enter the 6-digit code from the email.';
  return /^\d{6}$/.test(value.trim()) ? undefined : 'The code has 6 digits.';
}
