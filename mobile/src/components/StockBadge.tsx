import { StyleSheet, View } from 'react-native';

import type { StockStatus } from '@/api/types';
import { colors, radius, spacing } from '@/theme';
import { STOCK_LABELS } from '@/utils/format';

import { AppText } from './AppText';

const TONES: Record<StockStatus, { fg: string; bg: string }> = {
  in: { fg: colors.success, bg: colors.successBg },
  low: { fg: colors.warning, bg: colors.warningBg },
  out: { fg: colors.error, bg: colors.errorBg },
};

export function StockBadge({ status }: { status: StockStatus }) {
  const tone = TONES[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <AppText variant="caption" color={tone.fg} style={styles.text}>
        {STOCK_LABELS[status]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontWeight: '600' },
});
