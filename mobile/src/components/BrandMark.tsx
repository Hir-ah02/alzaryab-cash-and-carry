import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

/** The Al Zaryab logo lockup, matching the admin portal's basket mark. */
export function BrandMark() {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Al Zaryab Cash and Carry">
      <View style={styles.mark}>
        <Ionicons name="basket" size={22} color={colors.primaryPressed} />
      </View>
      <View>
        <AppText variant="heading">Al Zaryab</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          Cash &amp; Carry
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
