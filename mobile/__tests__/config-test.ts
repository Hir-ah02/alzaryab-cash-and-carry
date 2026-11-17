import { resolveApiBaseUrl } from '@/config/api';

describe('API address', () => {
  it('uses EXPO_PUBLIC_API_URL when set (trailing slash removed)', () => {
    expect(resolveApiBaseUrl({ envUrl: 'https://api.example.com/api/', platform: 'ios', isDev: false })).toBe(
      'https://api.example.com/api',
    );
  });

  it('in development, uses the computer running Expo (no hardcoded IP)', () => {
    expect(resolveApiBaseUrl({ hostUri: '192.168.1.20:8081', platform: 'android', isDev: true })).toBe(
      'http://192.168.1.20:8000/api',
    );
    expect(resolveApiBaseUrl({ hostUri: '192.168.1.20:8081', platform: 'ios', isDev: true })).toBe(
      'http://192.168.1.20:8000/api',
    );
  });

  it('maps loopback to the emulator alias on Android and localhost on iOS', () => {
    expect(resolveApiBaseUrl({ hostUri: 'localhost:8081', platform: 'android', isDev: true })).toBe('http://10.0.2.2:8000/api');
    expect(resolveApiBaseUrl({ hostUri: '127.0.0.1:8081', platform: 'ios', isDev: true })).toBe('http://localhost:8000/api');
    expect(resolveApiBaseUrl({ hostUri: null, platform: 'android', isDev: true })).toBe('http://10.0.2.2:8000/api');
  });

  it('release builds must be configured explicitly', () => {
    expect(resolveApiBaseUrl({ hostUri: '192.168.1.20:8081', platform: 'ios', isDev: false })).toBeNull();
    expect(resolveApiBaseUrl({ envUrl: '   ', platform: 'ios', isDev: false })).toBeNull();
  });

  it('release builds refuse a non-HTTPS API address', () => {
    expect(resolveApiBaseUrl({ envUrl: 'http://192.168.1.20:8000/api', platform: 'android', isDev: false })).toBeNull();
    expect(resolveApiBaseUrl({ envUrl: 'http://192.168.1.20:8000/api', platform: 'android', isDev: true })).toBe('http://192.168.1.20:8000/api');
  });
});
