import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ApiError, MESSAGES } from '@/api/errors';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText variant="label" color={colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

interface MessageStateProps {
  icon: IconName;
  title: string;
  text?: string;
  tone?: 'neutral' | 'error';
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, tone = 'neutral', action }: MessageStateProps) {
  const isError = tone === 'error';
  return (
    <View style={styles.center} accessibilityRole={isError ? 'alert' : undefined}>
      <View style={[styles.iconWrap, { backgroundColor: isError ? colors.errorBg : colors.primaryTint }]}>
        <Ionicons name={icon} size={28} color={isError ? colors.error : colors.primary} />
      </View>
      <AppText variant="heading" style={styles.centerText}>
        {title}
      </AppText>
      {text && (
        <AppText color={colors.textSecondary} style={styles.centerText}>
          {text}
        </AppText>
      )}
      {action}
    </View>
  );
}

/** Explains a failed request and offers to try again. Uses the ApiError's safe message. */
export function ErrorState({
  error,
  title = "Couldn't load this",
  onRetry,
  action,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  /** Extra button shown under (or instead of) Try again. */
  action?: ReactNode;
}) {
  const offline = error instanceof ApiError && error.isNetworkError;
  const message = error instanceof ApiError ? error.message : MESSAGES.server;
  return (
    <EmptyState
      icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
      tone="error"
      title={offline ? "You're offline" : title}
      text={message}
      action={
        (onRetry || action) && (
          <>
            {onRetry && <Button title="Try again" icon="refresh" variant="secondary" onPress={onRetry} />}
            {action}
          </>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
  iconWrap: { width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center', maxWidth: 320 },
});
