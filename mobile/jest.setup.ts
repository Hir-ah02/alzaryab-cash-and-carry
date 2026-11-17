/* Test doubles for native modules that have no JavaScript implementation in Jest. */
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  };
});

// Icon fonts are bundled assets; under Jest there is no asset registry, so report them as loaded.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(async () => {}),
  useFonts: jest.fn(() => [true, null]),
}));

// React Query keeps unused data for minutes (gcTime) using timers; in tests those
// timers would keep Jest running after the last test. Unref them so they don't.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { timeoutManager } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
const unref = <T,>(timer: T): T => {
  (timer as { unref?: () => void }).unref?.();
  return timer;
};
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => unref(globalThis.setTimeout(callback, delay)),
  clearTimeout: (id) => globalThis.clearTimeout(id),
  setInterval: (callback, delay) => unref(globalThis.setInterval(callback, delay)),
  clearInterval: (id) => globalThis.clearInterval(id),
});
