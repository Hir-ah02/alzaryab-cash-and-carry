import { useEffect, useState } from 'react';
import { CATEGORIES as FALLBACK_CATEGORIES } from '../data/categories';
import { listCategories } from '../services/categoryService';

// Last list from the server, shared by every page for this visit.
let cached = null;
const subscribers = new Set();

/** Reloads the active categories and updates every dropdown that is showing them. */
export async function refreshCategories() {
  const categories = await listCategories();
  cached = categories.map((c) => c.name);
  subscribers.forEach((notify) => notify(cached));
  return cached;
}

/**
 * Active category names from the API. Shows the last known list at once and
 * refreshes it in the background. If the API can't be reached, falls back to
 * the built-in list so filters and forms keep working (the server still
 * validates the category on save).
 */
export function useCategories() {
  const [names, setNames] = useState(cached ?? []);

  useEffect(() => {
    let cancelled = false;
    subscribers.add(setNames);
    refreshCategories().catch(() => {
      if (!cancelled && !cached) setNames(FALLBACK_CATEGORIES);
    });
    return () => {
      cancelled = true;
      subscribers.delete(setNames);
    };
  }, []);

  return names;
}
