import { useCallback, useEffect, useState } from 'react';

/**
 * `value`, but only after it has stopped changing for `delayMs`. `flush`
 * applies the latest value at once (e.g. when the customer presses Search).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): [T, () => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  const flush = useCallback(() => setDebounced(value), [value]);
  return [debounced, flush];
}
