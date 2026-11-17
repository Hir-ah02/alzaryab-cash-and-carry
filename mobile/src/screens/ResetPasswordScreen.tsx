/**
 * Step 2 of password recovery: the code from the email and a new password
 * (POST /customer/auth/password-reset/confirm/). On success every existing
 * session ends and the customer signs in with the new password.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { confirmPasswordReset, requestPasswordReset } from '@/api/auth';
import { ApiError, MESSAGES } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/theme';
import { emailError, PASSWORD_MIN_LENGTH, passwordError, resetCodeError, type FieldErrors } from '@/utils/validation';

type Field = 'email' | 'code' | 'password' | 'confirmPassword';

/** Matches PASSWORD_RESET_RESEND_SECONDS on the server. */
export const RESEND_SECONDS = 60;

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const [values, setValues] = useState({ email: params.email ?? '', code: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(params.sent ?? null);
  const [saving, setSaving] = useState(false);
  const [resendIn, setResendIn] = useState(params.sent ? RESEND_SECONDS : 0);
  const busy = useRef(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const field = (name: Field) => ({
    value: values[name],
    onChangeText: (text: string) => {
      setValues((v) => ({ ...v, [name]: text }));
      if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
    },
    error: errors[name],
  });

  const save = async () => {
    if (busy.current) return;
    const found: FieldErrors<Field> = {
      email: emailError(values.email),
      code: resetCodeError(values.code),
      password: passwordError(values.password),
      confirmPassword: !values.confirmPassword ? 'Enter the password again.' : values.confirmPassword !== values.password ? "Passwords don't match." : undefined,
    };
    const problems = Object.fromEntries(Object.entries(found).filter(([, v]) => v)) as FieldErrors<Field>;
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) return;

    busy.current = true;
    setSaving(true);
    try {
      await confirmPasswordReset({ email: values.email, code: values.code, password: values.password });
      router.replace({ pathname: '/login', params: { reset: '1', email: values.email.trim() } });
    } catch (err) {
      if (err instanceof ApiError && err.fields.password) {
        setErrors({ password: err.fields.password });
      } else if (err instanceof ApiError && err.fields.code) {
        setErrors({ code: err.fields.code });
      } else {
        setFormError(err instanceof ApiError ? err.message : MESSAGES.server);
      }
      setValues((v) => ({ ...v, confirmPassword: '' }));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const resend = async () => {
    if (busy.current || resendIn > 0) return;
    const found = emailError(values.email);
    if (found) {
      setErrors({ email: found });
      return;
    }
    busy.current = true;
    setFormError(null);
    try {
      setInfo(await requestPasswordReset(values.email));
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : MESSAGES.server);
    } finally {
      busy.current = false;
    }
  };

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          Choose a new password
        </AppText>
        <AppText color={colors.textSecondary}>Enter the 6-digit code we emailed you, then your new password.</AppText>
      </View>
      {info && !formError && <Notice tone="info">{info}</Notice>}
      {formError && <Notice tone="error">{formError}</Notice>}
      <TextField
        label="Email address"
        {...field('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <TextField
        label="6-digit code"
        {...field('code')}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordField
        ref={passwordRef}
        label="New password"
        helper={`At least ${PASSWORD_MIN_LENGTH} characters, not only numbers, and not a common password.`}
        {...field('password')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordField
        ref={confirmRef}
        label="Confirm new password"
        {...field('confirmPassword')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void save()}
      />
      <Button title="Save new password" icon="checkmark" onPress={() => void save()} loading={saving} fullWidth />
      <Button
        title={resendIn > 0 ? `Send a new code (${resendIn}s)` : 'Send a new code'}
        variant="ghost"
        icon="refresh"
        onPress={() => void resend()}
        disabled={resendIn > 0 || saving}
        accessibilityHint="Emails a new code; the old one stops working"
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
});
