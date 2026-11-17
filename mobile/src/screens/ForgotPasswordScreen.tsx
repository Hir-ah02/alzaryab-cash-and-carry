/**
 * Step 1 of password recovery: ask for a code by email
 * (POST /customer/auth/password-reset/). The answer is the same whether or
 * not an account exists, so this screen never says which emails are registered.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requestPasswordReset } from '@/api/auth';
import { ApiError, MESSAGES } from '@/api/errors';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/theme';
import { emailError } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const send = async () => {
    if (busy.current) return;
    const found = emailError(email);
    setError(found);
    setFormError(null);
    if (found) return;
    busy.current = true;
    setSending(true);
    try {
      const message = await requestPasswordReset(email);
      router.replace({ pathname: '/reset-password', params: { email: email.trim(), sent: message } });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : MESSAGES.server);
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  return (
    <FormScreen>
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          Forgot your password?
        </AppText>
        <AppText color={colors.textSecondary}>
          Enter the email you signed up with. We'll email you a 6-digit code to choose a new password.
        </AppText>
      </View>
      {formError && <Notice tone="error">{formError}</Notice>}
      <TextField
        label="Email address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (error) setError(undefined);
        }}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />
      <Button title="Email me a code" icon="mail-outline" onPress={() => void send()} loading={sending} fullWidth />
      <Button
        title="I already have a code"
        variant="ghost"
        onPress={() => router.replace({ pathname: '/reset-password', params: { email: email.trim() } })}
        disabled={sending}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
});
