import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type Tone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<Tone, { fg: string; bg: string; icon: ComponentProps<typeof Ionicons>['name'] }> = {
  info: { fg: colors.textSecondary, bg: colors.surfaceMuted, icon: 'information-circle-outline' },
  success: { fg: colors.success, bg: colors.successBg, icon: 'checkmark-circle-outline' },
  warning: { fg: colors.warning, bg: colors.warningBg, icon: 'alert-circle-outline' },
  error: { fg: colors.error, bg: colors.errorBg, icon: 'cloud-offline-outline' },
};

/** Inline message box. Warnings and errors are announced to screen readers. */
export function Notice({ tone = 'info', title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const t = TONES[tone];
  const urgent = tone === 'warning' || tone === 'error';
  return (
    <View
      style={[styles.box, { backgroundColor: t.bg }]}
      accessibilityRole={urgent ? 'alert' : undefined}
      accessibilityLiveRegion={urgent ? 'polite' : 'none'}
    >
      <Ionicons name={t.icon} size={20} color={t.fg} />
      <View style={styles.body}>
        {title && (
          <AppText variant="bodyStrong" color={tone === 'info' ? colors.text : t.fg}>
            {title}
          </AppText>
        )}
        {typeof children === 'string' ? <AppText variant="label" color={colors.text}>{children}</AppText> : children}
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  body: { flex: 1, gap: spacing.xs },
});
