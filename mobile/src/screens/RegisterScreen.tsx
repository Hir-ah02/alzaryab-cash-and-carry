/**
 * Create a customer account (POST /customer/auth/register/). The server always
 * creates a non-staff customer and signs them in. Passwords stay in this
 * screen's state only: never stored, logged or sent anywhere else.
 */
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ApiError, MESSAGES } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/theme';
import { normalizePhone, PASSWORD_MIN_LENGTH, splitFullName, validateRegistration, type FieldErrors, type RegistrationValues } from '@/utils/validation';

type Field = keyof RegistrationValues;
const EMPTY: RegistrationValues = { fullName: '', email: '', phone: '', password: '', confirmPassword: '' };

/** Server field names → form fields. */
const SERVER_FIELDS: Record<string, Field> = { firstName: 'fullName', lastName: 'fullName', email: 'email', phone: 'phone', password: 'password' };

export default function RegisterScreen() {
  const { register } = useAuth();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const refs = {
    email: useRef<ComponentRef<typeof TextInput>>(null),
    phone: useRef<ComponentRef<typeof TextInput>>(null),
    password: useRef<ComponentRef<typeof TextInput>>(null),
    confirmPassword: useRef<ComponentRef<typeof TextInput>>(null),
  };

  const field = (name: Field) => ({
    value: values[name],
    onChangeText: (text: string) => {
      setValues((v) => ({ ...v, [name]: text }));
      if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
    },
    error: errors[name],
  });

  const submit = async () => {
    if (busy.current) return;
    const found = validateRegistration(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      setFormError(MESSAGES.invalid);
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      const { firstName, lastName } = splitFullName(values.fullName);
      await register({ email: values.email.trim(), password: values.password, firstName, lastName, phone: normalizePhone(values.phone) });
      // Signed in: the guard closes this screen.
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        const mapped: FieldErrors<Field> = {};
        for (const [key, message] of Object.entries(err.fields)) {
          const target = SERVER_FIELDS[key];
          if (target && !mapped[target]) mapped[target] = message;
        }
        setErrors(mapped);
        setFormError(Object.keys(mapped).length > 0 ? MESSAGES.invalid : err.message);
      } else {
        setFormError(err instanceof ApiError ? err.message : MESSAGES.server);
      }
      setValues((v) => ({ ...v, confirmPassword: '' }));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          Create your account
        </AppText>
        <AppText color={colors.textSecondary}>Order groceries for delivery and pay cash when they arrive.</AppText>
      </View>
      {formError && <Notice tone="error">{formError}</Notice>}
      <TextField
        label="Full name"
        {...field('fullName')}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => refs.email.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={refs.email}
        label="Email address"
        {...field('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => refs.phone.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={refs.phone}
        label="Phone number (optional)"
        helper="For delivery updates, e.g. 0300 1234567"
        {...field('phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => refs.password.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordField
        ref={refs.password}
        label="Password"
        helper={`At least ${PASSWORD_MIN_LENGTH} characters, not only numbers, and not a common password.`}
        {...field('password')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => refs.confirmPassword.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordField
        ref={refs.confirmPassword}
        label="Confirm password"
        {...field('confirmPassword')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Button title="Create account" icon="person-add-outline" onPress={() => void submit()} loading={submitting} fullWidth />
      <View style={styles.switchRow}>
        <AppText color={colors.textSecondary}>Already have an account?</AppText>
        <Button title="Sign in" variant="ghost" onPress={() => router.replace('/login')} disabled={submitting} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  switchRow: { alignItems: 'center', gap: spacing.xs },
});
