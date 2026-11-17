/** Password recovery: request a code, then set a new password. The successful reset (navigation) is last. */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { fakeShop, mockFetch, resetApp, RESET_CODE, RESET_SENT, TEST_PASSWORD } from './helpers';

beforeEach(() => resetApp());

const NEW_PASSWORD = 'Brand-New-Pass-77';

async function open(url = '/forgot-password?email=ali%40example.com') {
  const shop = fakeShop();
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: url });
  return { shop, calls };
}

const set = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

it('asks for a code and shows the same answer for any email', async () => {
  const { shop } = await open();
  expect(await screen.findByText('Forgot your password?')).toBeTruthy();
  expect(screen.getByLabelText('Email address').props.value).toBe('ali@example.com');
  await fireEvent.press(screen.getByLabelText('Email me a code'));
  expect(await screen.findByText(RESET_SENT)).toBeTruthy();
  expect(screen.getByText('Choose a new password')).toBeTruthy();
  expect(shop.state.resetRequests).toEqual(['ali@example.com']);
  expect(screen.getByLabelText('Send a new code (60s)').props.accessibilityState.disabled).toBe(true);
});

it('checks the email before asking', async () => {
  const { shop } = await open('/forgot-password');
  await set('Email address', 'ali@');
  await fireEvent.press(screen.getByLabelText('Email me a code'));
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  expect(shop.state.resetRequests).toEqual([]);
});

it('validates the code and new password, and explains a wrong code', async () => {
  const { calls } = await open('/reset-password?email=ali%40example.com');
  await screen.findByText('Choose a new password');
  await fireEvent.press(screen.getByLabelText('Save new password'));
  expect(screen.getByText('Enter the 6-digit code from the email.')).toBeTruthy();
  expect(screen.getByText('Enter a password.')).toBeTruthy();

  await set('6-digit code', '111111');
  await set('New password', NEW_PASSWORD);
  await set('Confirm new password', 'different');
  await fireEvent.press(screen.getByLabelText('Save new password'));
  expect(screen.getByText("Passwords don't match.")).toBeTruthy();
  expect(calls.some((c) => c.url.includes('/confirm/'))).toBe(false);

  await set('Confirm new password', NEW_PASSWORD);
  await fireEvent.press(screen.getByLabelText('Save new password'));
  expect(await screen.findByText('This code is wrong or has expired. Check the email or ask for a new code.')).toBeTruthy();
});

it('shows the server’s password rules next to the field', async () => {
  await open('/reset-password?email=ali%40example.com');
  await screen.findByText('Choose a new password');
  await set('6-digit code', RESET_CODE);
  await set('New password', 'password123');
  await set('Confirm new password', 'password123');
  await fireEvent.press(screen.getByLabelText('Save new password'));
  expect(await screen.findByText('This password is too common.')).toBeTruthy();
});

it('can resend a code once the pause is over', async () => {
  const { shop } = await open('/reset-password?email=ali%40example.com');
  await screen.findByText('Choose a new password');
  await fireEvent.press(screen.getByLabelText('Send a new code'));
  await waitFor(() => expect(shop.state.resetRequests).toEqual(['ali@example.com']));
  expect(await screen.findByLabelText(/Send a new code \(\d+s\)/)).toBeTruthy();
  for (let second = 0; second < 61; second += 1) await act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByLabelText('Send a new code')).toBeTruthy();
});

it('sets the new password and returns to sign-in, which then works with it', async () => {
  const { shop } = await open('/login');
  await screen.findByText('Welcome back');
  await set('Email address', 'ali@example.com');
  await fireEvent.press(screen.getByLabelText('Forgot password?'));
  await fireEvent.press(await screen.findByLabelText('Email me a code'));
  await screen.findByText('Choose a new password');
  await set('6-digit code', RESET_CODE);
  await set('New password', NEW_PASSWORD);
  await set('Confirm new password', NEW_PASSWORD);
  await fireEvent.press(screen.getByLabelText('Save new password'));

  expect(await screen.findByText('Password changed')).toBeTruthy();
  expect(screen.getByLabelText('Email address').props.value).toBe('ali@example.com');
  expect(shop.state.password).toBe(NEW_PASSWORD);
  expect(NEW_PASSWORD).not.toBe(TEST_PASSWORD);
});
