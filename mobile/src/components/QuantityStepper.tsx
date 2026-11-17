import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, touchTarget } from '@/theme';

import { AppText } from './AppText';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Spoken name, e.g. "Quantity" or "Olpers Milk quantity". */
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * − value + control. Only ever produces whole numbers between min and max,
 * so a quantity can't be zero, negative or fractional. Screen readers get a
 * single adjustable element (swipe up/down).
 */
export function QuantityStepper({ value, min = 1, max, onChange, label = 'Quantity', disabled, compact }: QuantityStepperProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;
  const size = compact ? 40 : touchTarget;

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, Math.floor(value) + delta));
    if (next !== value) onChange(next);
  };

  return (
    <View
      style={[styles.row, disabled && styles.disabled]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      accessibilityState={{ disabled: !!disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Pressable
        testID="quantity-decrease"
        onPress={() => step(-1)}
        disabled={!canDecrease}
        hitSlop={compact ? 4 : 0}
        style={({ pressed }) => [styles.button, { width: size, height: size }, pressed && styles.pressed]}
      >
        <Ionicons name="remove" size={20} color={canDecrease ? colors.primary : colors.textDisabled} />
      </Pressable>
      <AppText variant="bodyStrong" style={styles.value}>
        {value}
      </AppText>
      <Pressable
        testID="quantity-increase"
        onPress={() => step(1)}
        disabled={!canIncrease}
        hitSlop={compact ? 4 : 0}
        style={({ pressed }) => [styles.button, { width: size, height: size }, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={20} color={canIncrease ? colors.primary : colors.textDisabled} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.55 },
  button: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  pressed: { backgroundColor: colors.primaryTint },
  value: { minWidth: 32, textAlign: 'center' },
});
