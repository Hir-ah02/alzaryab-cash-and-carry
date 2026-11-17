import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<Variant, { bg: string; pressed: string; text: string; border: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, text: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, pressed: colors.surfaceMuted, text: colors.primary, border: colors.borderStrong },
  ghost: { bg: 'transparent', pressed: colors.primaryTint, text: colors.primary, border: 'transparent' },
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, fullWidth, accessibilityHint, style }: ButtonProps) {
  const tone = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? tone.pressed : tone.bg, borderColor: tone.border },
        fullWidth && styles.fullWidth,
        inactive && styles.inactive,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={tone.text} />
        ) : (
          icon && <Ionicons name={icon} size={18} color={tone.text} accessibilityElementsHidden importantForAccessibility="no" />
        )}
        <AppText variant="bodyStrong" color={tone.text} style={typography.bodyStrong}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fullWidth: { alignSelf: 'stretch' },
  inactive: { opacity: 0.55 },
});
