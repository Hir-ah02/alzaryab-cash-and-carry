import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing, touchTarget } from '@/theme';

import { AppText } from './AppText';

interface CategoryChipProps {
  name: string;
  count?: number;
  onPress?: () => void;
}

export function CategoryChip({ name, count, onPress }: CategoryChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? name : `${name}, ${count} products`}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <AppText variant="label" color={colors.primaryPressed}>
        {name}
      </AppText>
      {count !== undefined && (
        <AppText variant="caption" color={colors.textSecondary}>
          {count}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  pressed: { backgroundColor: colors.primarySoft },
});
