import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

/** "Label ........ value" line for totals. `strong` for the grand total. */
export function SummaryRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label} ${value}`}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} color={muted ? colors.textSecondary : colors.text} style={styles.label}>
        {label}
      </AppText>
      <AppText variant={strong ? 'heading' : 'bodyStrong'}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { flex: 1 },
});
