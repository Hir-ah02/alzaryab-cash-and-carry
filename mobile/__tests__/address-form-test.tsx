/** Add and edit an address. The successful save navigates back, so it is last. */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { ADDRESS, fakeShop, jsonResponse, mockFetch, resetApp } from './helpers';

beforeEach(() => resetApp({ signedIn: true }));

async function open(url: string) {
  const shop = fakeShop();
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: url });
  return { shop, writes: () => calls.filter((c) => c.method === 'POST' || c.method === 'PATCH') };
}

const set = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

it('starts with the customer’s name and phone, and checks required fields', async () => {
  const { writes } = await open('/addresses/new');
  await waitFor(() => expect(screen.getByLabelText('Recipient name').props.value).toBe('Ali Raza'));
  expect(screen.getByLabelText('Phone number').props.value).toBe('03001112233');
  await fireEvent.press(screen.getByLabelText('Add address'));
  expect(screen.getByText('Enter the house and street.')).toBeTruthy();
  expect(screen.getByText('Enter the area.')).toBeTruthy();
  expect(screen.getByText('Enter the city.')).toBeTruthy();
  expect(writes()).toHaveLength(0);
});

it('shows server field errors', async () => {
  const { shop } = await open('/addresses/new');
  shop.state.intercept = (call) => (call.method === 'POST' ? jsonResponse(400, { phone: ['Enter a valid phone number, e.g. 03001234567 or +923001234567.'], city: ['Too long.'] }) : undefined);
  await set('House and street', 'House 9');
  await set('Area', 'DHA');
  await set('City', 'Lahore');
  await fireEvent.press(screen.getByLabelText('Add address'));
  expect(await screen.findByText('Too long.')).toBeTruthy();
});

it('edits an existing address with its current values', async () => {
  await open(`/addresses/${ADDRESS.id}`);
  await waitFor(() => expect(screen.getByLabelText('House and street').props.value).toBe(ADDRESS.line1));
  expect(screen.queryByLabelText('Make this my default address')).toBeNull(); // already the default
  expect(screen.getByLabelText('Save address')).toBeTruthy();
});

it('says when the address no longer exists', async () => {
  await open('/addresses/999');
  expect(await screen.findByText('Address not found')).toBeTruthy();
});

it('adds an address with exactly the API fields', async () => {
  const { writes, shop } = await open('/addresses/new');
  await waitFor(() => expect(screen.getByLabelText('Recipient name').props.value).toBe('Ali Raza'));
  await set('Label (optional)', ' Work ');
  await set('Phone number', '0321-555 6677');
  await set('House and street', 'Office 5, Main Boulevard');
  await set('Area', 'Gulberg III');
  await set('City', 'Lahore');
  await set('Delivery instructions (optional)', 'Reception desk');
  await fireEvent(screen.getByLabelText('Make this my default address'), 'valueChange', true);
  await fireEvent.press(screen.getByLabelText('Add address'));

  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(writes()[0].body).toEqual({
    label: 'Work',
    recipientName: 'Ali Raza',
    phone: '03215556677',
    line1: 'Office 5, Main Boulevard',
    line2: '',
    area: 'Gulberg III',
    city: 'Lahore',
    postalCode: '',
    instructions: 'Reception desk',
    isDefault: true,
  });
  await waitFor(() => expect(shop.state.addresses).toHaveLength(2));
});
