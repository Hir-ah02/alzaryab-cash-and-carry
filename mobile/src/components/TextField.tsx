import { useId, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  /** A control shown inside the field on the right, e.g. a show-password button. */
  trailing?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Labelled input with helper and error text. Errors are announced to screen readers. */
export function TextField({ label, error, helper, trailing, style, onFocus, onBlur, editable = true, ref, ...props }: TextFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={styles.wrap}>
      <AppText variant="label" nativeID={`${id}-label`}>
        {label}
      </AppText>
      <View style={[styles.box, { borderColor }, !editable && styles.readOnly]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${id}-label`}
          accessibilityHint={error}
          accessibilityState={{ disabled: !editable }}
          placeholderTextColor={colors.textTertiary}
          editable={editable}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, !editable && { color: colors.textSecondary }, style]}
        />
        {trailing}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color={colors.textSecondary}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  box: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  readOnly: { backgroundColor: colors.surfaceMuted },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
});
