import { Text, type TextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
}

/** Text using the app's type scale. Respects the device's font-size setting. */
export function AppText({ variant = 'body', color = colors.text, style, ...props }: AppTextProps) {
  return <Text {...props} style={[typography[variant], { color }, style]} maxFontSizeMultiplier={1.6} />;
}
