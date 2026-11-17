import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing, touchTarget } from '@/theme';

import { AppText } from './AppText';

/** Looks like a search box; opens the Search screen where typing happens. */
export function SearchEntry({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search products"
      accessibilityHint="Opens product search"
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}
    >
      <Ionicons name="search" size={20} color={colors.textSecondary} />
      <AppText color={colors.textTertiary}>Search milk, rice, atta…</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
});
