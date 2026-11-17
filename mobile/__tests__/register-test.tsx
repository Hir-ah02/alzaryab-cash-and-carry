/** Registration screen. The successful sign-up (which navigates) is last. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { fakeShop, mockFetch, resetApp } from './helpers';

const PASSWORD = 'Fresh#Mango2026';

beforeEach(() => resetApp());

async function openRegister() {
  const shop = fakeShop();
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/register' });
  await screen.findByText('Create your account');
  return { shop, registrations: () => calls.filter((c) => c.url.endsWith('/customer/auth/register/')) };
}

async function fill(values: Partial<Record<'Full name' | 'Email address' | 'Phone number (optional)' | 'Password' | 'Confirm password', string>>) {
  for (const [label, value] of Object.entries(values)) await fireEvent.changeText(screen.getByLabelText(label), value);
}

const submit = () => fireEvent.press(screen.getByLabelText('Create account'));

it('validates every field before sending', async () => {
  const { registrations } = await openRegister();
  await submit();
  expect(screen.getByText('Enter your name.')).toBeTruthy();
  expect(screen.getByText('Enter your email address.')).toBeTruthy();
  expect(screen.getByText('Enter a password.')).toBeTruthy();
  expect(screen.getByText('Enter the password again.')).toBeTruthy();

  await fill({ 'Full name': 'Sara Khan', 'Email address': 'sara@', 'Phone number (optional)': '123', Password: '1234567', 'Confirm password': 'nope' });
  await submit();
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  expect(screen.getByText('Enter a valid phone number, e.g. 03001234567 or +923001234567.')).toBeTruthy();
  expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
  expect(screen.getByText("Passwords don't match.")).toBeTruthy();
  expect(registrations()).toHaveLength(0);
});

it('shows the server’s reason next to the field', async () => {
  const { registrations } = await openRegister();
  await fill({ 'Full name': 'Ali Raza', 'Email address': 'ali@example.com', Password: PASSWORD, 'Confirm password': PASSWORD });
  await submit();
  expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
  expect(registrations()).toHaveLength(1);
  expect(screen.getByLabelText('Confirm password').props.value).toBe('');
  expect(await SecureStore.getItemAsync('alzaryab.customer.access')).toBeNull();
});

it('has show/hide on both password fields', async () => {
  await openRegister();
  await fireEvent.press(screen.getByLabelText('Show confirm password'));
  expect(screen.getByLabelText('Confirm password').props.secureTextEntry).toBe(false);
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
});

it('creates the account once, signs in, and never stores the password', async () => {
  const { registrations } = await openRegister();
  await fill({ 'Full name': '  Sara   Bano Khan ', 'Email address': ' sara@example.com ', 'Phone number (optional)': '0321-555 6677', Password: PASSWORD, 'Confirm password': PASSWORD });
  await Promise.all([submit(), submit()]);

  await waitFor(() => expect(screen).not.toHavePathname('/register'));
  expect(registrations()).toHaveLength(1);
  expect(registrations()[0].body).toEqual({ email: 'sara@example.com', password: PASSWORD, firstName: 'Sara', lastName: 'Bano Khan', phone: '03215556677' });
  expect(await SecureStore.getItemAsync('alzaryab.customer.refresh')).toBe('refresh-new');
  const stored = JSON.stringify(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()));
  expect(stored).not.toContain(PASSWORD);
  expect(stored).toContain('sara@example.com'); // the cached profile
});
