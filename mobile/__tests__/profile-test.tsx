/** Edit profile. The successful save navigates back, so it is last. */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { fakeShop, jsonResponse, mockFetch, resetApp } from './helpers';

beforeEach(() => resetApp({ signedIn: true }));

async function openProfile() {
  const shop = fakeShop();
  const calls = mockFetch(shop.handler);
  await renderRouter('src/app', { initialUrl: '/profile' });
  await waitFor(() => expect(screen.getByLabelText('Full name').props.value).toBe('Ali Raza'));
  return { shop, patches: () => calls.filter((c) => c.method === 'PATCH') };
}

it('shows the email read-only and validates before saving', async () => {
  const { patches } = await openProfile();
  expect(screen.getByLabelText('Email address').props.editable).toBe(false);
  await fireEvent.changeText(screen.getByLabelText('Full name'), ' ');
  await fireEvent.changeText(screen.getByLabelText('Phone number (optional)'), '12');
  await fireEvent.press(screen.getByLabelText('Save changes'));
  expect(screen.getByText('Enter your name.')).toBeTruthy();
  expect(screen.getByText('Enter a valid phone number, e.g. 03001234567 or +923001234567.')).toBeTruthy();
  expect(patches()).toHaveLength(0);
});

it('shows server errors (e.g. a phone number already in use)', async () => {
  const { shop } = await openProfile();
  shop.state.intercept = (call) => (call.method === 'PATCH' ? jsonResponse(400, { phone: ['This phone number is already registered.'] }) : undefined);
  await fireEvent.changeText(screen.getByLabelText('Phone number (optional)'), '0333 1234567');
  await fireEvent.press(screen.getByLabelText('Save changes'));
  expect(await screen.findByText('This phone number is already registered.')).toBeTruthy();
});

it('saves name and phone', async () => {
  const { patches } = await openProfile();
  await fireEvent.changeText(screen.getByLabelText('Full name'), 'Ali Hassan Raza');
  await fireEvent.changeText(screen.getByLabelText('Phone number (optional)'), '0333-123 4567');
  await fireEvent.press(screen.getByLabelText('Save changes'));
  await waitFor(() => expect(patches()).toHaveLength(1));
  expect(patches()[0].body).toEqual({ firstName: 'Ali', lastName: 'Hassan Raza', phone: '03331234567' });
});
