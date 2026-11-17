/**
 * Sign in with email and password (POST /customer/auth/login/). On success the
 * route guard closes this screen and, if the customer was on their way
 * somewhere (e.g. checkout), the root layout continues there. The password is
 * kept only in this screen's state and is never stored or logged.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ApiError, MESSAGES } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { setReturnTo } from '@/auth/returnTo';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/theme';
import { validateLogin, type FieldErrors } from '@/utils/validation';

export default function LoginScreen() {
  const { next, reset, email: prefilledEmail } = useLocalSearchParams<{ next?: string; reset?: string; email?: string }>();
  const { signIn, sessionExpired } = useAuth();
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (next) setReturnTo(next);
  }, [next]);

  const submit = async () => {
    if (busy.current) return; // one request at a time, however fast the button is tapped
    const found = validateLogin(email, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    busy.current = true;
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Signed in: the guard closes this screen.
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : MESSAGES.server);
      setPassword('');
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          Welcome back
        </AppText>
        <AppText color={colors.textSecondary}>Sign in to check out, save addresses and follow your orders. Your cart stays as it is.</AppText>
      </View>
      {reset === '1' && !formError && (
        <Notice tone="success" title="Password changed">
          Sign in with your new password. You were signed out on every other device.
        </Notice>
      )}
      {sessionExpired && !formError && reset !== '1' && <Notice tone="warning">{MESSAGES.expired}</Notice>}
      {formError && (
        <Notice tone="error" title="Couldn't sign in">
          {formError}
        </Notice>
      )}
      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Button title="Sign in" icon="log-in-outline" onPress={() => void submit()} loading={submitting} fullWidth />
      <Button
        title="Forgot password?"
        variant="ghost"
        onPress={() => router.push({ pathname: '/forgot-password', params: email.trim() ? { email: email.trim() } : {} })}
        disabled={submitting}
      />
      <View style={styles.switchRow}>
        <AppText color={colors.textSecondary}>New to Al Zaryab?</AppText>
        <Button title="Create an account" variant="ghost" onPress={() => router.replace('/register')} disabled={submitting} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  switchRow: { alignItems: 'center', gap: spacing.xs },
});
