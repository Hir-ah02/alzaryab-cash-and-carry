/** Address book: list, make default, delete with confirmation, limits. */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { ADDRESS, fakeShop, mockFetch, resetApp } from './helpers';

const WORK = { ...ADDRESS, id: 32, label: 'Work', line1: 'Office 5, Main Boulevard', isDefault: false };

beforeEach(() => resetApp({ signedIn: true }));

async function open(addresses = [ADDRESS, WORK]) {
  const shop = fakeShop({ addresses });
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/addresses' });
  return { shop, calls };
}

it('lists saved addresses with the default first', async () => {
  await open();
  expect(await screen.findByText('Home · Ali Raza')).toBeTruthy();
  expect(screen.getByText('Work · Ali Raza')).toBeTruthy();
  expect(screen.getByText('Default')).toBeTruthy();
  expect(screen.getAllByLabelText('Make default')).toHaveLength(1); // not offered for the current default
});

it('makes another address the default', async () => {
  const { calls, shop } = await open();
  await fireEvent.press(await screen.findByLabelText('Make default'));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ isDefault: true }));
  expect(calls.find((c) => c.method === 'PATCH')?.url).toContain('/customer/addresses/32/');
  await waitFor(() => expect(shop.state.addresses.find((a) => a.id === 32)?.isDefault).toBe(true));
  expect(await screen.findByLabelText('Make default')).toBeTruthy(); // now offered for Home
});

it('asks before deleting, and deletes only when confirmed', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { calls } = await open();
  await screen.findByText('Work · Ali Raza');
  await fireEvent.press(screen.getAllByLabelText('Delete')[1]);
  expect(alert.mock.calls[0][0]).toBe('Delete this address?');
  expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

  await act(() => alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!());
  await waitFor(() => expect(screen.queryByText('Work · Ali Raza')).toBeNull());
  expect(calls.find((c) => c.method === 'DELETE')?.url).toContain('/customer/addresses/32/');
  alert.mockRestore();
});

it('shows an empty state and the 10-address limit', async () => {
  await open([]);
  expect(await screen.findByText('No saved addresses')).toBeTruthy();
});

it('stops adding at 10 addresses', async () => {
  await open(Array.from({ length: 10 }, (_, i) => ({ ...ADDRESS, id: 100 + i, isDefault: i === 0 })));
  expect(await screen.findByText('You can save up to 10 addresses. Delete one to add another.')).toBeTruthy();
  expect(screen.getByLabelText('Add a new address').props.accessibilityState.disabled).toBe(true);
});
