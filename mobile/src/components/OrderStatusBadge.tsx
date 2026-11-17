import { StyleSheet, View } from 'react-native';

import type { OrderStatus } from '@/api/types';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

const TONES: Record<OrderStatus, { fg: string; bg: string }> = {
  pending: { fg: colors.warning, bg: colors.warningBg },
  confirmed: { fg: colors.primary, bg: colors.primaryTint },
  preparing: { fg: colors.primary, bg: colors.primaryTint },
  out_for_delivery: { fg: colors.primary, bg: colors.primarySoft },
  delivered: { fg: colors.success, bg: colors.successBg },
  cancelled: { fg: colors.error, bg: colors.errorBg },
};

/** Uses the server's label (statusLabel), coloured by status. */
export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  const tone = TONES[status] ?? TONES.pending;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessibilityLabel={`Status: ${label}`}>
      <AppText variant="caption" color={tone.fg} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.full },
  text: { fontWeight: '700' },
});
