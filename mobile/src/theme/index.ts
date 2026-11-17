/**
 * Al Zaryab design tokens. The palette matches the admin portal
 * (fresh green + warm gold) so the store has one recognisable identity.
 * Every screen and component takes colours, spacing and type from here.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#15803D',
  primaryPressed: '#166534',
  primarySoft: '#DCFCE7',
  primaryTint: '#F0FDF4',
  onPrimary: '#FFFFFF',

  accent: '#F5B800',
  accentSoft: '#FEF5D6',
  accentStrong: '#7A5600',

  background: '#F5F7F4',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAF8',
  border: '#E3E7E2',
  borderStrong: '#CDD3CC',

  text: '#17201A',
  textSecondary: '#5B6660',
  textTertiary: '#8B958E',
  textDisabled: '#A9B1AB',

  success: '#15803D',
  successBg: '#EAF7EE',
  warning: '#B45309',
  warningBg: '#FFF6E5',
  error: '#B42318',
  errorBg: '#FEF1F1',

  overlay: 'rgba(15, 26, 19, 0.48)',
} as const;

/** 4-point spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** Type scale. System fonts keep the app light and render Urdu names well. */
export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  price: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: '#10181A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    default: { elevation: 1 },
  }),
} as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const touchTarget = 48;

export const theme = { colors, spacing, radius, typography, shadows, touchTarget };
export type Theme = typeof theme;
