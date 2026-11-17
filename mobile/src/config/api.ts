/**
 * Where the app finds the Django API.
 *
 * 1. EXPO_PUBLIC_API_URL, if set (required for release builds, and it must be
 *    https:// there: passwords and tokens never travel unencrypted).
 * 2. In development: the computer running `npx expo start` (Expo reports its
 *    address as hostUri, e.g. "192.168.1.20:8081"), on port 8000. This works
 *    on simulators, emulators and phones on the same Wi-Fi without
 *    hardcoding any IP address.
 * 3. Last resort in development: localhost (iOS simulator) or 10.0.2.2
 *    (the Android emulator's alias for the computer).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const DEV_API_PORT = 8000;

interface ResolveOptions {
  envUrl?: string;
  hostUri?: string | null;
  platform: string;
  isDev: boolean;
}

export function resolveApiBaseUrl({ envUrl, hostUri, platform, isDev }: ResolveOptions): string | null {
  const configured = envUrl?.trim();
  if (configured) {
    if (!isDev && !/^https:\/\//i.test(configured)) return null; // release builds talk to HTTPS only
    return configured.replace(/\/+$/, '');
  }
  if (!isDev) return null; // release builds must be configured explicitly

  let host = hostUri?.split(':')[0]?.trim() || '';
  const isLoopback = !host || host === 'localhost' || host === '127.0.0.1';
  if (isLoopback) host = platform === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${DEV_API_PORT}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
  isDev: __DEV__,
});

export const REQUEST_TIMEOUT_MS = 15000;
