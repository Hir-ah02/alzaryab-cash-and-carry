import { apiRequest } from './apiClient.js';

/** Active categories, A–Z: [{ id, name, description, active, productCount, … }] */
export async function listCategories() {
  return apiRequest('/categories/');
}

/** Every category, including deactivated ones (for the Categories screen). */
export async function listAllCategories() {
  return apiRequest('/categories/?include_inactive=true');
}

/** Rejects with err.fields.name for a blank or duplicate name. */
export async function createCategory({ name, description = '' }) {
  return apiRequest('/categories/', { method: 'POST', body: { name: name.trim(), description } });
}

export async function updateCategory(id, changes) {
  const body = { ...changes };
  if (typeof body.name === 'string') body.name = body.name.trim();
  return apiRequest(`/categories/${encodeURIComponent(id)}/`, { method: 'PATCH', body });
}

/** Refused (400 with a message) while the category still has active products. */
export async function deactivateCategory(id) {
  await apiRequest(`/categories/${encodeURIComponent(id)}/`, { method: 'DELETE' });
  return { id };
}

export async function reactivateCategory(id) {
  return updateCategory(id, { active: true });
}
