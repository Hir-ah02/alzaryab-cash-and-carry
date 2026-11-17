import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, touchTarget } from '@/theme';

import { TextField, type TextFieldProps } from './TextField';

/** Password input with a show / hide button. The value lives only in the form's state. */
export function PasswordField(props: Omit<TextFieldProps, 'secureTextEntry' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      {...props}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`}
          style={styles.toggle}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
});
