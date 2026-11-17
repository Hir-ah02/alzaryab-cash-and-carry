/** Sign-in screen. The test that signs in successfully (and so navigates) is last. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { fakeShop, mockFetch, resetApp, STAFF_EMAIL, TEST_PASSWORD } from './helpers';

const APP = 'src/app';

beforeEach(() => resetApp());

async function openLogin() {
  const shop = fakeShop();
  const calls = mockFetch(shop.handler);
  await renderRouter(APP, { initialUrl: '/login' });
  await screen.findByText('Welcome back');
  return { calls, logins: () => calls.filter((c) => c.url.endsWith('/customer/auth/login/')) };
}

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email address'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

it('checks the form before sending anything', async () => {
  const { logins } = await openLogin();
  await fireEvent.press(screen.getByLabelText('Sign in'));
  expect(screen.getByText('Enter your email address.')).toBeTruthy();
  expect(screen.getByText('Enter your password.')).toBeTruthy();
  await fill('ali@', 'x');
  await fireEvent.press(screen.getByLabelText('Sign in'));
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  expect(logins()).toHaveLength(0);
});

it('explains wrong details, clears the password and stays signed out', async () => {
  const { logins } = await openLogin();
  await fill('ali@example.com', 'wrong-password');
  await fireEvent.press(screen.getByLabelText('Sign in'));
  expect(await screen.findByText('Incorrect email or password. Please try again.')).toBeTruthy();
  expect(screen.getByLabelText('Password').props.value).toBe('');
  expect(logins()).toHaveLength(1);
  expect(await SecureStore.getItemAsync('alzaryab.customer.access')).toBeNull();
});

it('sends admin accounts to the admin portal', async () => {
  await openLogin();
  await fill(STAFF_EMAIL, TEST_PASSWORD);
  await fireEvent.press(screen.getByLabelText('Sign in'));
  expect(await screen.findByText('This is an admin account. Please sign in to the Admin Portal instead.')).toBeTruthy();
});

it('shows and hides the password', async () => {
  await openLogin();
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  await fireEvent.press(screen.getByLabelText('Show password'));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  await fireEvent.press(screen.getByLabelText('Hide password'));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
});

it('explains a lost connection', async () => {
  await openLogin();
  mockFetch(() => {
    throw new TypeError('Network request failed');
  });
  await fill('ali@example.com', TEST_PASSWORD);
  await fireEvent.press(screen.getByLabelText('Sign in'));
  expect(await screen.findByText("Can't reach Al Zaryab. Check your internet connection and try again.")).toBeTruthy();
});

it('signs in once however often the button is tapped, keeps tokens in SecureStore only, and closes', async () => {
  const { logins } = await openLogin();
  await fill(' ali@example.com ', TEST_PASSWORD);
  const button = screen.getByLabelText('Sign in');
  await Promise.all([fireEvent.press(button), fireEvent.press(button), fireEvent.press(button)]);

  await waitFor(() => expect(screen).not.toHavePathname('/login'));
  expect(logins()).toHaveLength(1);
  expect(logins()[0].body).toEqual({ email: 'ali@example.com', password: TEST_PASSWORD });
  expect(await SecureStore.getItemAsync('alzaryab.customer.access')).toBe('access-1');
  const stored = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys());
  expect(JSON.stringify(stored)).not.toContain(TEST_PASSWORD);
  expect(JSON.stringify(stored)).not.toContain('access-1');
});
