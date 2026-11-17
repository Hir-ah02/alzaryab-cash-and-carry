import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

/**
 * Scrolling form that stays above the keyboard, keeps taps on buttons working
 * while the keyboard is open, and leaves room for the home indicator.
 * `footer` stays pinned below the scrolling content (e.g. the submit button).
 */
export function FormScreen({ children, footer, refreshControl }: { children: ReactNode; footer?: ReactNode; refreshControl?: ScrollViewProps['refreshControl'] }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView
        contentContainerStyle={[styles.content, !footer && { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
