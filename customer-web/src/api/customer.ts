// Copied from mobile/src/api/customer.ts (shared business logic, keep the two in step).
/** The signed-in customer's profile and address book (customer accounts only). */
import { apiRequest } from './client';
import type { Address, AddressInput, Customer } from './types';

export function getProfile(signal?: AbortSignal): Promise<Customer> {
  return apiRequest<Customer>('/customer/profile/', { auth: 'required', signal });
}

/** Email can't be changed here (it is the login name). */
export function updateProfile(changes: Partial<Pick<Customer, 'firstName' | 'lastName' | 'phone'>>): Promise<Customer> {
  return apiRequest<Customer>('/customer/profile/', { method: 'PATCH', body: changes, auth: 'required' });
}

/** Default address first. */
export function listAddresses(signal?: AbortSignal): Promise<Address[]> {
  return apiRequest<Address[]>('/customer/addresses/', { auth: 'required', signal });
}

/** The first address becomes the default automatically. Max 10 per customer. */
export function createAddress(input: AddressInput): Promise<Address> {
  return apiRequest<Address>('/customer/addresses/', { method: 'POST', body: input, auth: 'required' });
}

/** Send { isDefault: true } to make this the default address. */
export function updateAddress(id: number, changes: Partial<AddressInput>): Promise<Address> {
  return apiRequest<Address>(`/customer/addresses/${id}/`, { method: 'PATCH', body: changes, auth: 'required' });
}

/** Deleting the default promotes the most recent remaining address. Past orders keep their own copy. */
export async function deleteAddress(id: number): Promise<void> {
  await apiRequest(`/customer/addresses/${id}/`, { method: 'DELETE', auth: 'required' });
}
