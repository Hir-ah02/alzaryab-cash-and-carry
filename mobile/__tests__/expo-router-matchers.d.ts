// Types for the matchers expo-router/testing-library registers at runtime (not shipped as typings).
declare namespace jest {
  interface Matchers<R> {
    toHavePathname(pathname: string): R;
    toHavePathnameWithParams(pathname: string): R;
    toHaveSegments(segments: string[]): R;
    toHaveSearchParams(params: Record<string, string | string[]>): R;
  }
}
